"""Visual constants and application stylesheet for DynaX Studio."""

from __future__ import annotations


NAVY = "#17345F"
BLUE = "#2A5AA8"
BLUE_DARK = "#1B3E78"
BLUE_PALE = "#EAF2FC"
BACKGROUND = "#F4F7FA"
BORDER = "#DCE3EB"
TEXT = "#24364B"
MUTED = "#66778A"
GREEN = "#2E9B62"
AMBER = "#B7791F"
AMBER_PALE = "#FEF6E7"
AMBER_BORDER = "#F2D399"


APP_STYLESHEET = f"""
QMainWindow, QWidget#StudioRoot {{
    background: {BACKGROUND};
    color: {TEXT};
    font-family: "Segoe UI";
    font-size: 13px;
}}
QWidget#ContentArea {{ background: {BACKGROUND}; }}
QScrollArea#ContentScroll {{ background: transparent; border: 0; }}
QScrollArea#ContentScroll > QWidget > QWidget {{ background: transparent; }}
QWidget#Sidebar {{
    background: #FFFFFF;
    border-right: 1px solid {BORDER};
}}
QLabel#HeaderTitle {{ color: {NAVY}; font-size: 23px; font-weight: 700; }}
QLabel#HeaderSubtitle {{ color: {MUTED}; font-size: 12px; }}
QLabel#PageTitle {{ color: {NAVY}; font-size: 25px; font-weight: 700; }}
QLabel#PageIntro {{ color: {MUTED}; font-size: 13px; }}
QLabel#Breadcrumb {{ color: {MUTED}; font-size: 12px; }}
QLabel#FooterText {{ color: {MUTED}; font-size: 11px; }}
QLabel#ReadyDot {{ color: {GREEN}; font-size: 15px; }}
QFrame#WorkflowCard {{
    background: #FFFFFF;
    border: 1px solid {BORDER};
    border-radius: 10px;
}}
QFrame#WorkflowCard[disabledCard="true"] {{ background: #F8FAFC; }}
QLabel#CardTitle {{ color: {NAVY}; font-size: 17px; font-weight: 650; }}
QLabel#CardDescription {{ color: {MUTED}; font-size: 12px; }}
QLabel#ComingSoon {{
    color: {MUTED}; background: #EDF1F5; border-radius: 9px;
    padding: 3px 9px; font-size: 11px; font-weight: 600;
}}
QPushButton#CardAction {{
    color: #FFFFFF; background: {BLUE_DARK}; border: 0;
    border-radius: 6px; padding: 8px 17px; font-weight: 600;
}}
QPushButton#CardAction:hover {{ background: {BLUE}; }}
QPushButton#CardAction:disabled {{ color: #9AA8B5; background: #E6EBF0; }}
QPushButton#SecondaryAction {{
    color: {BLUE_DARK}; background: #FFFFFF; border: 1px solid {BORDER};
    border-radius: 6px; padding: 8px 15px; font-weight: 600;
}}
QPushButton#SecondaryAction:hover {{ background: {BLUE_PALE}; border-color: {BLUE}; }}
QPushButton#SidebarButton {{
    color: {TEXT}; background: transparent; border: 0; border-radius: 6px;
    padding: 10px 12px; text-align: left;
}}
QPushButton#SidebarButton:hover {{ background: {BLUE_PALE}; color: {BLUE_DARK}; }}
QPushButton#SidebarButton[active="true"] {{
    background: {BLUE_PALE}; color: {BLUE_DARK}; font-weight: 650;
}}
QPushButton#NavigationButton {{
    color: {BLUE_DARK}; background: #FFFFFF; border: 1px solid {BORDER};
    border-radius: 5px; padding: 5px 10px;
}}
QPushButton#NavigationButton:hover {{ background: {BLUE_PALE}; }}
QPushButton#NavigationButton:disabled {{ color: #AEB8C2; background: #F3F5F7; }}
QDialog {{ background: {BACKGROUND}; color: {TEXT}; }}
QLineEdit {{ background: #FFFFFF; border: 1px solid {BORDER}; border-radius: 5px; padding: 7px; }}
QFrame#UpdateBanner {{
    background: {AMBER_PALE}; border: 1px solid {AMBER_BORDER}; border-radius: 8px;
}}
QLabel#UpdateBannerTitle {{ color: {AMBER}; font-size: 14px; font-weight: 650; }}
QLabel#UpdateBannerBody {{ color: {TEXT}; font-size: 12px; }}
QPushButton#UpdateBannerPrimary {{
    color: #FFFFFF; background: {BLUE_DARK}; border: 0;
    border-radius: 6px; padding: 6px 14px; font-weight: 600;
}}
QPushButton#UpdateBannerPrimary:hover {{ background: {BLUE}; }}
QPushButton#UpdateBannerSecondary {{
    color: {BLUE_DARK}; background: #FFFFFF; border: 1px solid {AMBER_BORDER};
    border-radius: 6px; padding: 6px 12px;
}}
QPushButton#UpdateBannerSecondary:hover {{ background: #FFFFFF; border-color: {BLUE}; }}
"""
