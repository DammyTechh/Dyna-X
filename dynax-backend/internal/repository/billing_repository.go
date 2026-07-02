package repository

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/dynalimb/dynax-backend/internal/models"
	"github.com/dynalimb/dynax-backend/internal/repository/db"
)

// BillingRepository handles TheraPay plans, transactions and applications.
type BillingRepository struct{ db *db.Pool }

func NewBillingRepository(db *db.Pool) *BillingRepository { return &BillingRepository{db: db} }

const planCols = `id, patient_id, professional_id, plan_type, total_amount, amount_paid,
	sessions_total, sessions_used, status, next_payment_date, installment_amount,
	installment_interval, created_at, updated_at`

func (r *BillingRepository) scanPlans(ctx context.Context, query string, args ...interface{}) ([]models.TheraPay, error) {
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.TheraPay{}
	for rows.Next() {
		var p models.TheraPay
		if err := rows.Scan(&p.ID, &p.PatientID, &p.ProfessionalID, &p.PlanType, &p.TotalAmount,
			&p.AmountPaid, &p.SessionsTotal, &p.SessionsUsed, &p.Status, &p.NextPaymentDate,
			&p.InstallmentAmount, &p.InstallmentInterval, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *BillingRepository) CreatePlan(ctx context.Context, professionalID string, req *models.CreateTherapayRequest) (*models.TheraPay, error) {
	const q = `
		INSERT INTO public.therapay_plans
		  (patient_id, professional_id, plan_type, total_amount, sessions_total, installment_amount, installment_interval)
		VALUES ($1,$2,$3::payment_plan_type,$4,$5,$6,$7)
		RETURNING ` + planCols
	plans, err := r.scanPlans(ctx, q, req.PatientID, professionalID, req.PlanType, req.TotalAmount,
		req.SessionsTotal, req.InstallmentAmount, req.InstallmentInterval)
	if err != nil || len(plans) == 0 {
		return nil, err
	}
	return &plans[0], nil
}

func (r *BillingRepository) ListByUser(ctx context.Context, userID string, q *models.PaginationQuery) ([]models.TheraPay, int64, error) {
	var total int64
	if err := r.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM public.therapay_plans WHERE patient_id=$1 OR professional_id=$1`,
		userID).Scan(&total); err != nil {
		return nil, 0, err
	}
	plans, err := r.scanPlans(ctx,
		`SELECT `+planCols+` FROM public.therapay_plans
		 WHERE patient_id=$1 OR professional_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		userID, q.PageSize, q.Offset())
	return plans, total, err
}

func (r *BillingRepository) Get(ctx context.Context, planID string) (*models.TheraPay, error) {
	plans, err := r.scanPlans(ctx, `SELECT `+planCols+` FROM public.therapay_plans WHERE id=$1`, planID)
	if err != nil || len(plans) == 0 {
		return nil, err
	}
	return &plans[0], nil
}

func (r *BillingRepository) RecordPayment(ctx context.Context, planID string, amount float64, notes, recordedBy string) (*models.TheraPay, error) {
	plan, err := r.Get(ctx, planID)
	if err != nil {
		return nil, err
	}
	if plan == nil {
		return nil, errors.New("plan_not_found")
	}
	if _, err := r.db.Exec(ctx,
		`INSERT INTO public.payment_transactions (plan_id, patient_id, professional_id, amount, notes, recorded_by)
		 VALUES ($1,$2,$3,$4,$5,$6)`,
		planID, plan.PatientID, plan.ProfessionalID, amount, nilIfEmptyStr(notes), recordedBy); err != nil {
		return nil, err
	}
	if err := r.db.ExecOne(ctx,
		`UPDATE public.therapay_plans
		 SET amount_paid = amount_paid + $2,
		     status = CASE WHEN amount_paid + $2 >= total_amount THEN 'completed'::payment_status ELSE status END,
		     reminder_sent_at = NULL,
		     updated_at = NOW()
		 WHERE id=$1`, planID, amount); err != nil {
		return nil, err
	}
	return r.Get(ctx, planID)
}

func (r *BillingRepository) Cancel(ctx context.Context, planID string) error {
	return r.db.ExecOne(ctx,
		`UPDATE public.therapay_plans SET status='cancelled'::payment_status, updated_at=NOW() WHERE id=$1`, planID)
}

func (r *BillingRepository) PatientBalance(ctx context.Context, patientID string) (map[string]interface{}, error) {
	var totalDue, totalPaid float64
	err := r.db.QueryRow(ctx,
		`SELECT COALESCE(SUM(total_amount),0), COALESCE(SUM(amount_paid),0)
		 FROM public.therapay_plans WHERE patient_id=$1 AND status='active'`, patientID).
		Scan(&totalDue, &totalPaid)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"total_due":  totalDue,
		"total_paid": totalPaid,
		"balance":    totalDue - totalPaid,
		"currency":   "NGN",
	}, nil
}

func (r *BillingRepository) CreateApplication(ctx context.Context, patientID string, data map[string]interface{}) (map[string]interface{}, error) {
	planType, _ := data["plan_type"].(string)
	if planType == "" {
		planType = "session"
	}
	reason, _ := data["reason"].(string)
	raw, _ := json.Marshal(data)
	var id string
	err := r.db.QueryRow(ctx,
		`INSERT INTO public.therapay_applications (patient_id, plan_type, reason, application_data)
		 VALUES ($1,$2,$3,$4::jsonb) RETURNING id`,
		patientID, planType, nilIfEmptyStr(reason), string(raw)).Scan(&id)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{"id": id, "status": "pending"}, nil
}

func (r *BillingRepository) ListApplications(ctx context.Context, userID string, isAdmin bool, q *models.PaginationQuery) ([]interface{}, int64, error) {
	where := "WHERE patient_id=$1 OR professional_id=$1"
	countArgs := []interface{}{userID}
	listArgs := []interface{}{userID, q.PageSize, q.Offset()}
	if isAdmin {
		where = "WHERE TRUE"
		countArgs = []interface{}{}
		listArgs = []interface{}{q.PageSize, q.Offset()}
	}
	var total int64
	countQ := `SELECT COUNT(*) FROM public.therapay_applications ` + where
	if err := r.db.QueryRow(ctx, countQ, countArgs...).Scan(&total); err != nil {
		return nil, 0, err
	}
	listQ := `SELECT id, patient_id, plan_type, requested_amount, status, review_notes, created_at::text
		 FROM public.therapay_applications ` + where + ` ORDER BY created_at DESC `
	if isAdmin {
		listQ += `LIMIT $1 OFFSET $2`
	} else {
		listQ += `LIMIT $2 OFFSET $3`
	}
	rows, err := r.db.Query(ctx, listQ, listArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []interface{}{}
	for rows.Next() {
		var id, patientID, planType, status, createdAt string
		var amount *float64
		var reviewNotes *string
		if err := rows.Scan(&id, &patientID, &planType, &amount, &status, &reviewNotes, &createdAt); err != nil {
			return nil, 0, err
		}
		out = append(out, map[string]interface{}{
			"id": id, "patient_id": patientID, "plan_type": planType,
			"requested_amount": amount, "status": status, "review_notes": reviewNotes, "created_at": createdAt,
		})
	}
	return out, total, rows.Err()
}

// ReviewApplication sets an application to approved/rejected and returns the
// patient and (optional) professional ids so callers can notify them.
func (r *BillingRepository) ReviewApplication(ctx context.Context, appID, reviewerID, status, notes string) (patientID string, professionalID *string, err error) {
	err = r.db.QueryRow(ctx,
		`UPDATE public.therapay_applications
		   SET status=$2, reviewed_by=$3, reviewed_at=NOW(), review_notes=$4, updated_at=NOW()
		 WHERE id=$1
		 RETURNING patient_id, professional_id`,
		appID, status, reviewerID, nilIfEmptyStr(notes)).Scan(&patientID, &professionalID)
	return patientID, professionalID, err
}
