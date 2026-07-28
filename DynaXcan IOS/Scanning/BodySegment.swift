import Foundation

/// Body segments supported by DynaXcan clinical scanning workflows.
enum BodySegment: String, CaseIterable, Codable {
    case residualLimbTranstibial = "residual_limb_tt"
    case residualLimbTransfemoral = "residual_limb_tf"
    case foot
    case hand
    case lowerLeg = "lower_leg"
    case upperLimb = "upper_limb"
    case torso
    case spinalRegion = "spinal_region"
    case generic

    var displayName: String {
        switch self {
        case .residualLimbTranstibial: "Residual Limb (Below Knee)"
        case .residualLimbTransfemoral: "Residual Limb (Above Knee)"
        case .foot: "Foot & Ankle"
        case .hand: "Hand & Wrist"
        case .lowerLeg: "Lower Leg"
        case .upperLimb: "Upper Limb"
        case .torso: "Torso"
        case .spinalRegion: "Spinal Region"
        case .generic: "Other / Generic"
        }
    }

    var clinicalDescription: String {
        switch self {
        case .residualLimbTranstibial: "Below-knee residual limb"
        case .residualLimbTransfemoral: "Above-knee residual limb"
        case .foot: "Foot and ankle complex"
        case .hand: "Hand and wrist"
        case .lowerLeg: "Lower leg"
        case .upperLimb: "Upper limb and forearm"
        case .torso: "Torso and trunk"
        case .spinalRegion: "Spinal and posterior region"
        case .generic: "Generic object or body region"
        }
    }

    var distalReference: String {
        switch self {
        case .residualLimbTranstibial, .residualLimbTransfemoral: "the tip of the limb"
        case .foot: "the toes and sole"
        case .hand: "the fingertips"
        case .lowerLeg: "the ankle and foot"
        case .upperLimb: "the wrist and hand"
        case .torso, .spinalRegion: "the lower boundary"
        case .generic: "the lower end"
        }
    }

    var proximalReference: String {
        switch self {
        case .residualLimbTranstibial, .residualLimbTransfemoral: "the top of the limb"
        case .foot: "the ankle and lower leg"
        case .hand: "the wrist"
        case .lowerLeg: "the knee"
        case .upperLimb: "the shoulder"
        case .torso, .spinalRegion: "the upper boundary"
        case .generic: "the upper end"
        }
    }
}
