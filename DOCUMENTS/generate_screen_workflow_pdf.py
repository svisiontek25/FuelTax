"""
Complete Application Screen Flow & User Interaction Workflow Specification
PDF Generator for FuelTaxPulse Enterprise
Replicates the visual layout, wireframes, and action matrix from the IRS-HVUT specification template.
"""

import sys
from datetime import datetime

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.pdfgen import canvas

class NumberedCanvasWorkflow(canvas.Canvas):
    """Two-pass canvas for dynamic Page X of Y and running headers/footers."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        if self._pageNumber == 1:
            return  # Suppress on cover page

        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))

        # Footer
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 25, page_str)
        self.restoreState()


def build_workflow_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    # Brand Colors
    NAVY = colors.HexColor("#0F172A")
    BLUE_DARK = colors.HexColor("#1E3A8A")
    ROYAL_BLUE = colors.HexColor("#1D4ED8")
    ACCENT_BLUE = colors.HexColor("#2563EB")
    SLATE = colors.HexColor("#334155")
    MUTED = colors.HexColor("#64748B")
    LIGHT_BG = colors.HexColor("#F8FAFC")
    BORDER_COLOR = colors.HexColor("#CBD5E1")
    GREEN_BG = colors.HexColor("#F0FDF4")
    GREEN_BORDER = colors.HexColor("#BBF7D0")
    GREEN_TEXT = colors.HexColor("#166534")

    # Typography styles
    styles.add(ParagraphStyle(
        'CoverBadge',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#93C5FD"),
        alignment=TA_LEFT
    ))
    styles.add(ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=30,
        textColor=colors.white,
        alignment=TA_LEFT
    ))
    styles.add(ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=16,
        textColor=colors.HexColor("#E2E8F0"),
        alignment=TA_LEFT
    ))
    styles.add(ParagraphStyle(
        'CoverMetaLabel',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#FBBF24")
    ))
    styles.add(ParagraphStyle(
        'CoverMetaVal',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=colors.white
    ))

    # Screen Header Styles
    styles.add(ParagraphStyle(
        'ScreenTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        textColor=colors.white
    ))
    styles.add(ParagraphStyle(
        'RoutePill',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.white,
        alignment=TA_RIGHT
    ))
    styles.add(ParagraphStyle(
        'MetaLabel',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=10.5,
        textColor=NAVY
    ))
    styles.add(ParagraphStyle(
        'MetaValue',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=10.5,
        textColor=SLATE
    ))
    styles.add(ParagraphStyle(
        'ScreenPurpose',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=11,
        textColor=SLATE,
        alignment=TA_JUSTIFY
    ))
    styles.add(ParagraphStyle(
        'ActionMatrixHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=BLUE_DARK,
        spaceBefore=4,
        spaceAfter=3
    ))
    styles.add(ParagraphStyle(
        'ActionHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7,
        leading=9.5,
        textColor=colors.white,
        alignment=TA_LEFT
    ))
    styles.add(ParagraphStyle(
        'ActionCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=6.5,
        leading=8.5,
        textColor=NAVY,
        alignment=TA_LEFT
    ))
    styles.add(ParagraphStyle(
        'ActionCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=6.5,
        leading=8.5,
        textColor=SLATE,
        alignment=TA_LEFT
    ))
    styles.add(ParagraphStyle(
        'NextDestText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7,
        leading=9.5,
        textColor=GREEN_TEXT
    ))

    # Wireframe Mockup Typography
    styles.add(ParagraphStyle('WNavLogo', fontName='Helvetica-Bold', fontSize=7.5, leading=9.5, textColor=colors.white))
    styles.add(ParagraphStyle('WNavLinks', fontName='Helvetica', fontSize=6.5, leading=8.5, textColor=colors.HexColor("#E2E8F0"), alignment=TA_RIGHT))
    styles.add(ParagraphStyle('WHeroTitle', fontName='Helvetica-Bold', fontSize=10, leading=13, textColor=NAVY, alignment=TA_CENTER))
    styles.add(ParagraphStyle('WHeroSub', fontName='Helvetica', fontSize=6.5, leading=8.5, textColor=MUTED, alignment=TA_CENTER))
    styles.add(ParagraphStyle('WCardTitle', fontName='Helvetica-Bold', fontSize=7, leading=9, textColor=BLUE_DARK))
    styles.add(ParagraphStyle('WCardBody', fontName='Helvetica', fontSize=6, leading=8, textColor=SLATE))
    styles.add(ParagraphStyle('WBtnAmber', fontName='Helvetica-Bold', fontSize=6.5, leading=8.5, textColor=colors.white, alignment=TA_CENTER))
    styles.add(ParagraphStyle('WBtnBlue', fontName='Helvetica-Bold', fontSize=6.5, leading=8.5, textColor=colors.white, alignment=TA_CENTER))
    styles.add(ParagraphStyle('WTableHeader', fontName='Helvetica-Bold', fontSize=6, leading=8, textColor=colors.white))
    styles.add(ParagraphStyle('WTableCell', fontName='Helvetica', fontSize=5.5, leading=7.5, textColor=SLATE))

    story = []

    # =========================================================================
    # 1. COVER PAGE (Replicating exact IRS-HVUT Cover Template)
    # =========================================================================
    cover_cell = [
        Spacer(1, 25),
        Paragraph("FUELTAXPULSE V1.1 · COMPLETE INTERACTION BLUEPRINT", styles['CoverBadge']),
        Spacer(1, 10),
        Paragraph("Complete Application Screen Flow &<br/>User Interaction Workflow<br/>Specification", styles['CoverTitle']),
        Spacer(1, 14),
        Paragraph("End-to-End Visual Layouts, Element Inventories, Action-State Transitions & IFTA Compliance Workflow for Web/UI Designers & Developers", styles['CoverSubtitle']),
        Spacer(1, 350),
    ]

    meta_grid = [
        [
            Paragraph("Target Systems:", styles['CoverMetaLabel']),
            Paragraph("IFTA Quarterly Fuel Tax (Schedule 1) & State Mileage Tax", styles['CoverMetaVal']),
            Paragraph("Document ID:", styles['CoverMetaLabel']),
            Paragraph("FTP-SPEC-WF-2026-V1", styles['CoverMetaVal'])
        ],
        [
            Paragraph("Compliance Scope:", styles['CoverMetaLabel']),
            Paragraph("58 Member Jurisdictions · Diesel Only", styles['CoverMetaVal']),
            Paragraph("Application Scope:", styles['CoverMetaLabel']),
            Paragraph("All 15 Distinct Screen Views & States", styles['CoverMetaVal'])
        ],
        [
            Paragraph("Target Deliverable:", styles['CoverMetaLabel']),
            Paragraph("Outsourcing Handover Document", styles['CoverMetaVal']),
            Paragraph("Author:", styles['CoverMetaLabel']),
            Paragraph("FuelTaxPulse Engineering Team", styles['CoverMetaVal'])
        ],
    ]
    meta_box = Table(meta_grid, colWidths=[90, 160, 90, 160])
    meta_box.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#0B1329")),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#1E3A8A")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#172554")),
    ]))

    cover_cell.append(meta_box)
    cover_cell.append(Spacer(1, 15))

    cover_table = Table([[cover_cell]], colWidths=[540])
    cover_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#172554")),
        ('TOPPADDING', (0, 0), (-1, -1), 16),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 16),
        ('LEFTPADDING', (0, 0), (-1, -1), 20),
        ('RIGHTPADDING', (0, 0), (-1, -1), 20),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#1E3A8A")),
    ]))
    story.append(cover_table)
    story.append(PageBreak())

    # =========================================================================
    # HELPER FUNCTION TO RENDER A FULL SCREEN SPECIFICATION PAGE
    # =========================================================================
    def render_screen_spec(
        screen_id, screen_name, route,
        access_tier, entry_point, purpose_text,
        wireframe_flowable,
        action_matrix_data,
        next_destination_text
    ):
        # 1. Top Header Banner
        header_table = Table([
            [Paragraph(f"{screen_id}: {screen_name}", styles['ScreenTitle']),
             Paragraph(f"<font backcolor='#1D4ED8'>&nbsp;{route}&nbsp;</font>", styles['RoutePill'])]
        ], colWidths=[400, 140])
        header_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), NAVY),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(header_table)

        # 2. Access Tier & Entry Point Block
        meta_table = Table([
            [Paragraph("<b>Access Tier:</b> " + access_tier, styles['MetaValue']),
             Paragraph("<b>Entry Point:</b> " + entry_point, styles['MetaValue'])]
        ], colWidths=[240, 300])
        meta_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
            ('BOX', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(meta_table)

        # 3. Screen Purpose Box
        purpose_box = Table([
            [Paragraph(f"<b>Screen Purpose:</b> {purpose_text}", styles['ScreenPurpose'])]
        ], colWidths=[540])
        purpose_box.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
            ('BOX', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(purpose_box)
        story.append(Spacer(1, 4))

        # 4. Visual Layout Mockup
        story.append(wireframe_flowable)
        story.append(Spacer(1, 4))

        # 5. Interactive Action Matrix
        story.append(Paragraph("Interactive Action Matrix: What Happens When User Takes Any Action", styles['ActionMatrixHeading']))

        # Convert action_matrix_data to Table with Paragraphs
        table_rows = [
            [Paragraph("UI Element / Control", styles['ActionHeader']),
             Paragraph("Type", styles['ActionHeader']),
             Paragraph("Trigger", styles['ActionHeader']),
             Paragraph("System Reaction, Validation & State Transition", styles['ActionHeader'])]
        ]
        for row in action_matrix_data:
            table_rows.append([
                Paragraph(row[0], styles['ActionCellBold']),
                Paragraph(row[1], styles['ActionCell']),
                Paragraph(row[2], styles['ActionCell']),
                Paragraph(row[3], styles['ActionCell']),
            ])

        matrix_table = Table(table_rows, colWidths=[110, 85, 55, 290])
        matrix_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), BLUE_DARK),
            ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
        ]))
        story.append(matrix_table)
        story.append(Spacer(1, 4))

        # 6. Next Destination & State Transition Box
        dest_box = Table([
            [Paragraph(f"<b>Next Destination & State Transition:</b> {next_destination_text}", styles['NextDestText'])]
        ], colWidths=[540])
        dest_box.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), GREEN_BG),
            ('BOX', (0, 0), (-1, -1), 0.75, GREEN_BORDER),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(dest_box)
        story.append(PageBreak())

    # =========================================================================
    # SCREEN 01: PUBLIC LANDING / HOMEPAGE
    # =========================================================================
    wf_scr1 = Table([
        [Table([
            [Paragraph("🛡️ <b>FuelTaxPulse Enterprise</b> · IFTA Compliance", styles['WNavLogo']),
             Paragraph("58 Jurisdictions | Diesel Only | Sign In | <b>Register Free</b>", styles['WNavLinks'])]
        ], colWidths=[260, 260], style=[('BACKGROUND', (0,0), (-1,-1), BLUE_DARK), ('TOPPADDING', (0,0), (-1,-1), 3), ('BOTTOMPADDING', (0,0), (-1,-1), 3)])],
        [Table([
            [Paragraph("Automate IFTA Quarterly Tax Returns & 4-Year Audit Defense", styles['WHeroTitle'])],
            [Paragraph("Commercial multi-fleet IFTA calculation, GPS/ELD mileage import, 4-column fuel reconciliations, and weight-distance taxes.", styles['WHeroSub'])],
            [Table([
                [Paragraph("<b>Get Started Free</b>", styles['WBtnAmber']), Paragraph("<b>Sign In to Fleet Portal</b>", styles['WBtnBlue'])]
            ], colWidths=[100, 120], style=[
                ('BACKGROUND', (0,0), (0,0), colors.HexColor("#F59E0B")),
                ('BACKGROUND', (1,0), (1,0), ACCENT_BLUE),
                ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                ('TOPPADDING', (0,0), (-1,-1), 3),
                ('BOTTOMPADDING', (0,0), (-1,-1), 3),
            ])]
        ], colWidths=[520], style=[('ALIGN', (0,0), (-1,-1), 'CENTER'), ('TOPPADDING', (0,0), (-1,-1), 4)])],
        [Table([
            [Paragraph("⚡ <b>58 Jurisdictions</b><br/>US 48 + DC + 10 Canadian Provinces", styles['WCardBody']),
             Paragraph("⛽ <b>Diesel Only</b><br/>Standardized fuel use tax engine", styles['WCardBody']),
             Paragraph("📍 <b>ZIP Distance</b><br/>Haversine + 1.18 circuity calculator", styles['WCardBody']),
             Paragraph("🔒 <b>Audit Defense</b><br/>4-Year encrypted ZIP filing archives", styles['WCardBody'])]
        ], colWidths=[130, 130, 130, 130], style=[
            ('BACKGROUND', (0,0), (-1,-1), LIGHT_BG),
            ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
            ('TOPPADDING', (0,0), (-1,-1), 3),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ])]
    ], colWidths=[540], style=[
        ('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ])

    render_screen_spec(
        screen_id="SCR-01",
        screen_name="Public Landing / Homepage",
        route="/",
        access_tier="Public (Guest / All Users)",
        entry_point="Direct entry via web domain root URL, or clicking 'Home' in navigation.",
        purpose_text="Serves as the high-converting marketing, product overview, and instant onboarding portal. Features feature banners, compliance badges, direct access to the tax calculator, and quick login.",
        wireframe_flowable=wf_scr1,
        action_matrix_data=[
            ["Register Free Account Button", "Primary CTA (Amber)", "Click", "Redirects to /register to initiate new user account creation."],
            ["Sign In Button / Link", "Secondary Nav Button", "Click", "Navigates to /login for returning carriers."],
            ["Tax Calculator Link", "Navigation Link", "Click", "Navigates to /calculator for instant IFTA tax estimation."],
            ["Feature Showcase Cards", "Interactive Cards", "Hover / Click", "Expands compliance highlights: 58 Jurisdictions, Diesel Standard, ZIP Calculator."],
            ["Start Filing CTA Button", "Hero Call-to-Action", "Click", "If authenticated: navigates to /dashboard. If unauthenticated: navigates to /register."],
            ["IFTA Compliance Badge", "Trust Indicator", "View", "Displays official IFTA 58-jurisdiction compliance badge and encryption seals."],
        ],
        next_destination_text="User clicks Register -> /register; User clicks Sign In -> /login; User clicks Calculator -> /calculator."
    )

    # =========================================================================
    # SCREEN 02: USER REGISTRATION & FLEET ONBOARDING
    # =========================================================================
    wf_scr2 = Table([
        [Table([
            [Paragraph("Create Your Carrier Account", styles['WHeroTitle'])],
            [Paragraph("Set up your carrier organization, default fleet jurisdiction, and credentials.", styles['WHeroSub'])],
            [Table([
                [Paragraph("Company / Carrier Name", styles['WCardBody']), Paragraph("Full Legal Name (e.g. SvisionTek Logistics)", styles['WTableCell'])],
                [Paragraph("Corporate Email Address", styles['WCardBody']), Paragraph("admin@carrier.com", styles['WTableCell'])],
                [Paragraph("Base Jurisdiction (State/Prov)", styles['WCardBody']), Paragraph("AR — Arkansas (IFTA Base)", styles['WTableCell'])],
                [Paragraph("USDOT Number (Optional)", styles['WCardBody']), Paragraph("1234567", styles['WTableCell'])],
                [Paragraph("Account Password", styles['WCardBody']), Paragraph("••••••••••••", styles['WTableCell'])],
            ], colWidths=[160, 300], style=[
                ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
                ('BACKGROUND', (0,0), (0,-1), LIGHT_BG),
                ('TOPPADDING', (0,0), (-1,-1), 2),
                ('BOTTOMPADDING', (0,0), (-1,-1), 2),
            ])],
            [Table([[Paragraph("<b>Complete Registration & Launch Fleet Dashboard</b>", styles['WBtnBlue'])]], colWidths=[280], style=[
                ('BACKGROUND', (0,0), (-1,-1), ACCENT_BLUE),
                ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                ('TOPPADDING', (0,0), (-1,-1), 3),
                ('BOTTOMPADDING', (0,0), (-1,-1), 3),
            ])]
        ], colWidths=[520], style=[('ALIGN', (0,0), (-1,-1), 'CENTER'), ('TOPPADDING', (0,0), (-1,-1), 3)])]
    ], colWidths=[540], style=[('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR)])

    render_screen_spec(
        screen_id="SCR-02",
        screen_name="Carrier User Registration & Onboarding",
        route="/register",
        access_tier="Public (Guest)",
        entry_point="Clicked 'Register Free' from Homepage or login screen.",
        purpose_text="Captures carrier identity, base IFTA jurisdiction, DOT number, and user credentials. Automatically provisions the root organization, default fleet, carrier profile, and 3 starter power units.",
        wireframe_flowable=wf_scr2,
        action_matrix_data=[
            ["Company Name Input", "Text Input", "Type", "Captures legal carrier name. Auto-provisions organization and fleet."],
            ["Email Address Input", "Email Input", "Type & Blur", "Validates format; verifies email is unique across organizations."],
            ["Base Jurisdiction Dropdown", "Select Dropdown", "Change", "Selects home jurisdiction (e.g. AR, TX, IL). Sets default IFTA rate table."],
            ["USDOT Number Field", "Numeric Input", "Type", "Captures DOT identification number for regulatory reporting."],
            ["Password Input", "Password Input", "Type", "Enforces minimum 8 characters; hashes via bcrypt (cost=12)."],
            ["Complete Registration Button", "Primary Submit CTA", "Click", "Posts to /api/auth/register. On success: sets JWT and launches /dashboard."],
            ["Already have account link", "Text Link", "Click", "Switches view to /login."],
        ],
        next_destination_text="Registration successful -> navigates to /dashboard with starter fleet; Click sign-in -> /login."
    )

    # =========================================================================
    # SCREEN 03: SECURE CARRIER LOGIN
    # =========================================================================
    wf_scr3 = Table([
        [Table([
            [Paragraph("Sign In to FuelTaxPulse", styles['WHeroTitle'])],
            [Paragraph("Access your fleets, quarterly filings, and compliance reports.", styles['WHeroSub'])],
            [Table([
                [Paragraph("Corporate Email", styles['WCardBody']), Paragraph("admin@carrier.com", styles['WTableCell'])],
                [Paragraph("Account Password", styles['WCardBody']), Paragraph("••••••••••••", styles['WTableCell'])],
            ], colWidths=[140, 260], style=[
                ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
                ('BACKGROUND', (0,0), (0,-1), LIGHT_BG),
                ('TOPPADDING', (0,0), (-1,-1), 2),
                ('BOTTOMPADDING', (0,0), (-1,-1), 2),
            ])],
            [Table([
                [Paragraph("<b>Sign In to Fleet Portal</b>", styles['WBtnBlue']),
                 Paragraph("<b>Quick Demo: Carrier Login</b>", styles['WBtnAmber'])]
            ], colWidths=[150, 160], style=[
                ('BACKGROUND', (0,0), (0,0), ACCENT_BLUE),
                ('BACKGROUND', (1,0), (1,0), colors.HexColor("#F59E0B")),
                ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                ('TOPPADDING', (0,0), (-1,-1), 3),
                ('BOTTOMPADDING', (0,0), (-1,-1), 3),
            ])]
        ], colWidths=[520], style=[('ALIGN', (0,0), (-1,-1), 'CENTER'), ('TOPPADDING', (0,0), (-1,-1), 4)])]
    ], colWidths=[540], style=[('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR)])

    render_screen_spec(
        screen_id="SCR-03",
        screen_name="Carrier Authentication & Secure Login",
        route="/login",
        access_tier="Public (Guest)",
        entry_point="Clicked 'Sign In' from Header or redirected from protected view.",
        purpose_text="Authenticates returning carriers, fleet dispatchers, and compliance accountants with email/password credentials or 1-click demo evaluation profiles.",
        wireframe_flowable=wf_scr3,
        action_matrix_data=[
            ["Email Address Field", "Email Input", "Type", "Accepts registered email."],
            ["Password Field", "Password Input", "Type", "Validates password against bcrypt hash in database."],
            ["Sign In Button", "Primary Submit CTA", "Click", "Calls POST /api/auth/login. Stores JWT token and redirects to /dashboard."],
            ["Quick Demo Button", "Demo Button", "Click", "Pre-fills demo credentials and logs in immediately for instant evaluation."],
            ["Back to Home Link", "Navigation Link", "Click", "Returns to public landing page."],
        ],
        next_destination_text="Valid credentials -> /dashboard; Invalid credentials -> renders inline red error alert."
    )

    # =========================================================================
    # SCREEN 04: EXECUTIVE FLEET COMPLIANCE DASHBOARD
    # =========================================================================
    wf_scr4 = Table([
        [Table([
            [Paragraph("Fleet: <b>SvisionTek Fleet 1 (AR)</b>", styles['WCardTitle']),
             Paragraph("Quarter: <b>2026-Q1</b> | Fuel: <b>DIESEL</b> | Status: <b>Draft Active</b>", styles['WCardBody'])]
        ], colWidths=[260, 260], style=[('BACKGROUND', (0,0), (-1,-1), LIGHT_BG), ('TOPPADDING', (0,0), (-1,-1), 2), ('BOTTOMPADDING', (0,0), (-1,-1), 2)])],
        [Table([
            [Paragraph("📊 <b>Total Miles</b><br/><b>3,820.0 mi</b>", styles['WCardBody']),
             Paragraph("⛽ <b>Total Gallons</b><br/><b>650.0 gal</b>", styles['WCardBody']),
             Paragraph("🚚 <b>Fleet MPG</b><br/><b>5.88 MPG</b>", styles['WCardBody']),
             Paragraph("💵 <b>Net IFTA Tax</b><br/><b>$142.85 Due</b>", styles['WCardBody'])]
        ], colWidths=[130, 130, 130, 130], style=[
            ('BACKGROUND', (0,0), (-1,-1), colors.white),
            ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
            ('TOPPADDING', (0,0), (-1,-1), 3),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ])],
        [Table([
            [Paragraph("Guided Filing Workflow:", styles['WCardTitle']),
             Paragraph("1. Add Power Units -> 2. Ingest CSV -> 3. Review Summary -> 4. Finalize & Lock", styles['WCardBody'])]
        ], colWidths=[140, 380], style=[('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#EFF6FF")), ('TOPPADDING', (0,0), (-1,-1), 2), ('BOTTOMPADDING', (0,0), (-1,-1), 2)])]
    ], colWidths=[540], style=[('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR)])

    render_screen_spec(
        screen_id="SCR-04",
        screen_name="Executive Fleet Compliance Dashboard",
        route="/dashboard",
        access_tier="Authenticated Carrier / Fleet Manager",
        entry_point="Automatic landing after successful authentication or clicking 'Dashboard' in Navbar.",
        purpose_text="Command central displaying live KPI cards (Total Miles, Total Gallons, Fleet MPG, Net Tax Balance), 4-step guided compliance workflow, active corridor mileage map, and compliance warnings.",
        wireframe_flowable=wf_scr4,
        action_matrix_data=[
            ["Fleet Switcher Dropdown", "Select Switcher", "Change", "Switches active carrier fleet; instantly recalculates all metrics and reports."],
            ["Quarter Selector Dropdown", "Select Switcher", "Change", "Switches reporting period (e.g. 2026-Q1, 2025-Q4); refreshes tax data."],
            ["Guided Step 1 Button", "Workflow CTA", "Click", "Navigates to /power-units to register or review vehicle fleet."],
            ["Guided Step 2 Button", "Workflow CTA", "Click", "Navigates to /csv-ingestion to upload mileage or fuel files."],
            ["Guided Step 3 Button", "Workflow CTA", "Click", "Navigates to /summary to review the Schedule 1 return."],
            ["Lock Quarter Trigger", "Security CTA", "Click", "Freezes quarterly filing snapshot and issues 4-year audit defense package."],
        ],
        next_destination_text="Clicking guided steps routes to /power-units, /csv-ingestion, /summary, or /reports."
    )

    # =========================================================================
    # SCREEN 05: CUSTOMER MASTER & REGULATORY BANKING SETUP
    # =========================================================================
    wf_scr5 = Table([
        [Table([
            [Paragraph("Customer Master — 6-Tab Configuration Modal", styles['WCardTitle'])],
            [Paragraph("Tabs: [ Info ]  [ Accounts ]  [ Options / Banking ]  [ Notes ]  [ Employee Access ]  [ Customer Access ]", styles['WNavLinks'])]
        ], colWidths=[520], style=[('BACKGROUND', (0,0), (-1,-1), BLUE_DARK), ('TOPPADDING', (0,0), (-1,-1), 2), ('BOTTOMPADDING', (0,0), (-1,-1), 2)])],
        [Table([
            [Paragraph("Bank Name", styles['WCardBody']), Paragraph("JPMorgan Chase Bank, N.A.", styles['WTableCell'])],
            [Paragraph("Bank Routing Number (9 Digits)", styles['WCardBody']), Paragraph("••••••••• (Masked 9-Digit ABA)", styles['WTableCell'])],
            [Paragraph("Bank Account Number", styles['WCardBody']), Paragraph("••••••••••••• (Preserves Leading Zeros)", styles['WTableCell'])],
            [Paragraph("Save Customer Gate Status", styles['WCardBody']), Paragraph("Disabled until user clicks final tab [ Customer Access ]", styles['WTableCell'])],
        ], colWidths=[180, 340], style=[
            ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
            ('BACKGROUND', (0,0), (0,-1), LIGHT_BG),
            ('TOPPADDING', (0,0), (-1,-1), 2),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ])]
    ], colWidths=[540], style=[('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR)])

    render_screen_spec(
        screen_id="SCR-05",
        screen_name="Customer Master & Regulatory Banking Setup",
        route="/customers",
        access_tier="Authenticated Carrier / Financial Officer",
        entry_point="Clicked 'Customer Master' button in top bar or Customer Directory tab.",
        purpose_text="Configures carrier legal profiles, permits, notes, employee permissions, and masked banking credentials. Gated save button prevents incomplete customer profiles.",
        wireframe_flowable=wf_scr5,
        action_matrix_data=[
            ["Tab Navigation Bar", "Tab Control", "Click", "Switches between Info, Accounts, Options, Notes, Employee, Customer Access."],
            ["Info Tab UI Cleanup", "Form View", "View", "Corporate incorporation and officer SSN fields removed from UI."],
            ["Bank Routing Number Field", "Masked Input", "Type & Blur", "Enforces strict 9-digit ABA numeric regex; rejects 8 or 10 digits with HTTP 400."],
            ["Bank Account Number Field", "Masked Input", "Type", "Accepts 4–17 digits as text string; preserves leading zeros."],
            ["Save Customer Action Button", "Primary Action CTA", "Click", "Disabled on tabs 1–5. Enables only when tab 6 (Customer Access) is reached."],
            ["Cancel / Close Modal", "Secondary Action", "Click", "Closes modal without saving uncommitted changes."],
        ],
        next_destination_text="Save customer successful -> refreshes Customer Directory; Click close -> returns to active tab."
    )

    # =========================================================================
    # SCREEN 06: POWER UNIT INVENTORY & VEHICLE MANAGER
    # =========================================================================
    wf_scr6 = Table([
        [Table([
            [Paragraph("Power Unit Inventory (Fleet Power Units)", styles['WCardTitle']),
             Paragraph("+ Add New Power Unit | Export Vehicle Fleet", styles['WNavLinks'])]
        ], colWidths=[280, 240], style=[('BACKGROUND', (0,0), (-1,-1), BLUE_DARK), ('TOPPADDING', (0,0), (-1,-1), 2), ('BOTTOMPADDING', (0,0), (-1,-1), 2)])],
        [Table([
            [Paragraph("Unit #", styles['WTableHeader']), Paragraph("VIN (17 Digits)", styles['WTableHeader']), Paragraph("Make / Model", styles['WTableHeader']), Paragraph("Year", styles['WTableHeader']), Paragraph("Fuel", styles['WTableHeader']), Paragraph("GVW / Axles", styles['WTableHeader']), Paragraph("Actions", styles['WTableHeader'])],
            [Paragraph("Unit 101", styles['WTableCell']), Paragraph("1FUJGLDR5DP101001", styles['WTableCell']), Paragraph("Freightliner Cascadia", styles['WTableCell']), Paragraph("2024", styles['WTableCell']), Paragraph("DIESEL", styles['WTableCell']), Paragraph("80,000 lbs / 5", styles['WTableCell']), Paragraph("<b>Edit</b> | Delete", styles['WTableCell'])],
            [Paragraph("Unit 102", styles['WTableCell']), Paragraph("1XKAD49X6ER102002", styles['WTableCell']), Paragraph("Kenworth T680", styles['WTableCell']), Paragraph("2023", styles['WTableCell']), Paragraph("DIESEL", styles['WTableCell']), Paragraph("80,000 lbs / 5", styles['WTableCell']), Paragraph("<b>Edit</b> | Delete", styles['WTableCell'])],
            [Paragraph("Unit 103", styles['WTableCell']), Paragraph("3AKJHHDR7FR103003", styles['WTableCell']), Paragraph("Peterbilt 579", styles['WTableCell']), Paragraph("2025", styles['WTableCell']), Paragraph("DIESEL", styles['WTableCell']), Paragraph("80,000 lbs / 5", styles['WTableCell']), Paragraph("<b>Edit</b> | Delete", styles['WTableCell'])],
        ], colWidths=[55, 120, 110, 45, 50, 90, 70], style=[
            ('BACKGROUND', (0,0), (-1,0), NAVY),
            ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
            ('TOPPADDING', (0,0), (-1,-1), 2),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, LIGHT_BG]),
        ])]
    ], colWidths=[540], style=[('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR)])

    render_screen_spec(
        screen_id="SCR-06",
        screen_name="Power Unit Inventory & Vehicle Registry",
        route="/power-units",
        access_tier="Authenticated Carrier / Fleet Dispatcher",
        entry_point="Clicked 'Power Units' tab in top navigation.",
        purpose_text="Registers and maintains the carrier's commercial tractor fleet. Allows editing truck specs (Make, Model, Year, GVW, Axles) via PUT /api/vehicles/{id} without corrupting historical mileage or tax records.",
        wireframe_flowable=wf_scr6,
        action_matrix_data=[
            ["Add Power Unit Button", "Modal Trigger CTA", "Click", "Opens vehicle registration modal with 17-character VIN validator."],
            ["Edit Vehicle Button", "Table Action CTA", "Click", "Opens edit modal pre-filled with unit data for updating specs."],
            ["VIN 17-Character Input", "Text Input", "Type", "Enforces exactly 17 alphanumeric characters (rejects letters I, O, Q)."],
            ["Save Vehicle Update", "Primary Submit CTA", "Click", "Sends PUT to /api/vehicles/{id}. Preserves historical mileage/tax records."],
            ["Retire / Delete Truck", "Table Action CTA", "Click", "Confirms soft-retirement of unit from future active filing quarters."],
        ],
        next_destination_text="Edit successful -> updates table instantly; Add truck -> creates vehicle record in SQLite."
    )

    # =========================================================================
    # SCREEN 07: INGESTION STAGING HUB & CSV MAPPER
    # =========================================================================
    wf_scr7 = Table([
        [Table([
            [Paragraph("CSV Ingestion Staging Pipeline & Column Mapper", styles['WCardTitle']),
             Paragraph("Supported: Mileage (6-Col) | Fuel (4-Col)", styles['WNavLinks'])]
        ], colWidths=[300, 220], style=[('BACKGROUND', (0,0), (-1,-1), BLUE_DARK), ('TOPPADDING', (0,0), (-1,-1), 2), ('BOTTOMPADDING', (0,0), (-1,-1), 2)])],
        [Table([
            [Paragraph("Drag & drop CSV or Excel spreadsheet here, or click to browse files...", styles['WHeroSub'])],
            [Table([
                [Paragraph("<b>Total Uploaded</b><br/>10 Records", styles['WCardBody']),
                 Paragraph("<b>New Inserted</b><br/>7 Records", styles['WCardBody']),
                 Paragraph("<b>Existing Updated</b><br/>2 Records", styles['WCardBody']),
                 Paragraph("<b>Duplicate Skipped</b><br/>1 Record", styles['WCardBody']),
                 Paragraph("<b>Failed / Errors</b><br/>0 Errors", styles['WCardBody'])]
            ], colWidths=[100, 100, 100, 100, 100], style=[
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#EFF6FF")),
                ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
                ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                ('TOPPADDING', (0,0), (-1,-1), 2),
                ('BOTTOMPADDING', (0,0), (-1,-1), 2),
            ])],
            [Table([[Paragraph("<b>Commit Staged Records to Database (Atomic Transaction)</b>", styles['WBtnBlue'])]], colWidths=[320], style=[
                ('BACKGROUND', (0,0), (-1,-1), ACCENT_BLUE),
                ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                ('TOPPADDING', (0,0), (-1,-1), 3),
                ('BOTTOMPADDING', (0,0), (-1,-1), 3),
            ])]
        ], colWidths=[520], style=[('ALIGN', (0,0), (-1,-1), 'CENTER'), ('TOPPADDING', (0,0), (-1,-1), 3)])]
    ], colWidths=[540], style=[('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR)])

    render_screen_spec(
        screen_id="SCR-07",
        screen_name="Ingestion Staging Hub & CSV Column Mapper",
        route="/csv-ingestion",
        access_tier="Authenticated Carrier / Data Specialist",
        entry_point="Clicked 'CSV Ingestion' in navigation.",
        purpose_text="Parses and stages Mileage and Fuel spreadsheets. Normalizes dates, executes composite business key matching, recalculates taxable distance, and renders a 5-card Import Summary report upon atomic commit.",
        wireframe_flowable=wf_scr7,
        action_matrix_data=[
            ["File Upload Dropzone", "File Dropzone", "Drop / File", "Accepts .csv, .xlsx, .xls. Detects Mileage vs Fuel by header inspection."],
            ["Column Mapper Controls", "Select Dropdowns", "Change", "Maps arbitrary carrier headers to standard internal attributes."],
            ["Stage CSV Button", "Action Button", "Click", "Calls /api/ingestion/stage-csv. Displays preview of Insert/Update/Skip rows."],
            ["Commit to Database CTA", "Primary Submit CTA", "Click", "Calls /api/ingestion/commit. Commits atomically; renders 5 summary cards."],
            ["Download Templates", "Utility Links", "Click", "Downloads standard 6-column mileage or 4-column fuel CSV sample files."],
        ],
        next_destination_text="Commit successful -> button turns green ('✓ Committed to Database'); auto-links to Schedule 1 /summary."
    )

    # =========================================================================
    # SCREEN 08: MILEAGE GRID & ZIP DISTANCE CALCULATOR
    # =========================================================================
    wf_scr8 = Table([
        [Table([
            [Paragraph("Corridor Mileage Grid & ZIP-to-ZIP Highway Distance Calculator", styles['WCardTitle']),
             Paragraph("Export Calculated CSV | Use for Fleet Mileage", styles['WNavLinks'])]
        ], colWidths=[320, 200], style=[('BACKGROUND', (0,0), (-1,-1), BLUE_DARK), ('TOPPADDING', (0,0), (-1,-1), 2), ('BOTTOMPADDING', (0,0), (-1,-1), 2)])],
        [Table([
            [Paragraph("Unit #: <b>Unit 101</b>", styles['WCardBody']),
             Paragraph("Origin ZIP: <b>72764</b> (Springdale, AR)", styles['WCardBody']),
             Paragraph("Dest ZIP: <b>75201</b> (Dallas, TX)", styles['WCardBody']),
             Paragraph("Distance: <b>330.8 mi</b> (Road)", styles['WCardBody'])],
            [Paragraph("Calculation Method: <b>Commercial Road Distance (Haversine × 1.18 Circuity Multiplier)</b>", styles['WCardBody'])],
        ], colWidths=[120, 140, 140, 120], style=[
            ('BACKGROUND', (0,0), (-1,-1), LIGHT_BG),
            ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
            ('TOPPADDING', (0,0), (-1,-1), 2),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ])],
        [Table([
            [Paragraph("Date", styles['WTableHeader']), Paragraph("Unit #", styles['WTableHeader']), Paragraph("State", styles['WTableHeader']), Paragraph("Total Miles", styles['WTableHeader']), Paragraph("Taxable Miles", styles['WTableHeader']), Paragraph("Exempt Miles", styles['WTableHeader']), Paragraph("Actions", styles['WTableHeader'])],
            [Paragraph("2026-01-12", styles['WTableCell']), Paragraph("Unit 101", styles['WTableCell']), Paragraph("AR", styles['WTableCell']), Paragraph("210.5", styles['WTableCell']), Paragraph("210.5", styles['WTableCell']), Paragraph("0.0", styles['WTableCell']), Paragraph("Edit | Del", styles['WTableCell'])],
            [Paragraph("2026-01-14", styles['WTableCell']), Paragraph("Unit 101", styles['WTableCell']), Paragraph("TX", styles['WTableCell']), Paragraph("330.8", styles['WTableCell']), Paragraph("330.8", styles['WTableCell']), Paragraph("0.0", styles['WTableCell']), Paragraph("Edit | Del", styles['WTableCell'])],
        ], colWidths=[65, 60, 50, 75, 75, 75, 140], style=[
            ('BACKGROUND', (0,0), (-1,0), NAVY),
            ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
            ('TOPPADDING', (0,0), (-1,-1), 2),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ])]
    ], colWidths=[540], style=[('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR)])

    render_screen_spec(
        screen_id="SCR-08",
        screen_name="Corridor Mileage Grid & ZIP Distance Calculator",
        route="/mileage-grid",
        access_tier="Authenticated Carrier / Dispatcher",
        entry_point="Clicked 'Mileage Grid' tab in top navigation.",
        purpose_text="Combines an offline-capable 5-digit US ZIP-to-ZIP highway distance estimation engine with a spreadsheet-style multi-row manual mileage entry grid.",
        wireframe_flowable=wf_scr8,
        action_matrix_data=[
            ["Origin ZIP Code Field", "Numeric Input", "Type", "Validates 5-digit US postal code (rejects invalid ZIPs like 00000)."],
            ["Destination ZIP Code Field", "Numeric Input", "Type", "Validates 5-digit destination code."],
            ["Calculate Distance Button", "Action Button", "Click", "Computes Haversine geodesic distance and applies 1.18x highway circuity."],
            ["Use for Fleet Mileage CTA", "Primary Action CTA", "Click", "Saves calculated distance into active fleet mileage data directly."],
            ["Export Calculated CSV", "Utility Link", "Click", "Exports 4-column CSV: Vehicle ID, Jurisdiction, Total Distance, Date."],
            ["Manual Mileage Row Entry", "Inline Table Row", "Submit", "Adds manual corridor record with duplicate prevention."],
        ],
        next_destination_text="Calculated record committed -> refreshes table; Export CSV -> downloads mileage file."
    )

    # =========================================================================
    # SCREEN 09: FUEL PURCHASE LEDGER & RECEIPT ENTRY
    # =========================================================================
    wf_scr9 = Table([
        [Table([
            [Paragraph("Fuel Purchase Ledger (Diesel Transactions)", styles['WCardTitle']),
             Paragraph("Export 4-Col CSV | + Manual Purchase Entry", styles['WNavLinks'])]
        ], colWidths=[300, 220], style=[('BACKGROUND', (0,0), (-1,-1), BLUE_DARK), ('TOPPADDING', (0,0), (-1,-1), 2), ('BOTTOMPADDING', (0,0), (-1,-1), 2)])],
        [Table([
            [Paragraph("Date", styles['WTableHeader']), Paragraph("Unit #", styles['WTableHeader']), Paragraph("Jurisdiction", styles['WTableHeader']), Paragraph("Quantity (Gal)", styles['WTableHeader']), Paragraph("Fuel Type", styles['WTableHeader']), Paragraph("Tax Paid Pump", styles['WTableHeader']), Paragraph("Actions", styles['WTableHeader'])],
            [Paragraph("2026-01-12", styles['WTableCell']), Paragraph("Unit 101", styles['WTableCell']), Paragraph("TX", styles['WTableCell']), Paragraph("140.00", styles['WTableCell']), Paragraph("DIESEL", styles['WTableCell']), Paragraph("Yes (Tax-Paid)", styles['WTableCell']), Paragraph("Edit | Delete", styles['WTableCell'])],
            [Paragraph("2026-01-18", styles['WTableCell']), Paragraph("Unit 102", styles['WTableCell']), Paragraph("AR", styles['WTableCell']), Paragraph("125.50", styles['WTableCell']), Paragraph("DIESEL", styles['WTableCell']), Paragraph("Yes (Tax-Paid)", styles['WTableCell']), Paragraph("Edit | Delete", styles['WTableCell'])],
            [Paragraph("2026-01-25", styles['WTableCell']), Paragraph("Unit 103", styles['WTableCell']), Paragraph("OK", styles['WTableCell']), Paragraph("110.00", styles['WTableCell']), Paragraph("DIESEL", styles['WTableCell']), Paragraph("Yes (Tax-Paid)", styles['WTableCell']), Paragraph("Edit | Delete", styles['WTableCell'])],
        ], colWidths=[70, 65, 75, 80, 70, 90, 90], style=[
            ('BACKGROUND', (0,0), (-1,0), NAVY),
            ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
            ('TOPPADDING', (0,0), (-1,-1), 2),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, LIGHT_BG]),
        ])]
    ], colWidths=[540], style=[('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR)])

    render_screen_spec(
        screen_id="SCR-09",
        screen_name="Fuel Purchase Ledger & Receipt Entry",
        route="/fuel",
        access_tier="Authenticated Carrier / Fuel Manager",
        entry_point="Clicked 'Fuel Ledger' tab in top navigation.",
        purpose_text="Displays the transactional diesel fuel purchase history. Allows manual entry with duplicate prevention and one-click export of clean 4-column CSV fuel reports.",
        wireframe_flowable=wf_scr9,
        action_matrix_data=[
            ["Manual Fuel Entry Form", "Inline Form", "Submit", "Accepts Unit Number, State, Quantity (Gal > 0), and Date."],
            ["Duplicate Guard", "Validation Rule", "Auto-check", "Blocks duplicate submission for identical fleet, unit, state, date, and gallons."],
            ["Export 4-Col CSV Button", "Utility Link", "Click", "Calls /api/reports/export-fuel-csv. Generates Unit, State, Quantity, Date."],
            ["Edit Purchase Row", "Table Action CTA", "Click", "Allows updating fuel gallons or state purchase record."],
            ["Delete Purchase Row", "Table Action CTA", "Click", "Removes incorrect fuel entry; refreshes Schedule 1 totals."],
        ],
        next_destination_text="Fuel purchase saved -> table reloads; Export CSV -> downloads fuel report."
    )

    # =========================================================================
    # SCREEN 10: SEQUENTIAL TRIP ROUTING & BORDER VALIDATOR
    # =========================================================================
    wf_scr10 = Table([
        [Table([
            [Paragraph("Sequential Corridor Trip Entry & Border Adjacency Validator", styles['WCardTitle']),
             Paragraph("BFS State Border Crossing Check", styles['WNavLinks'])]
        ], colWidths=[320, 200], style=[('BACKGROUND', (0,0), (-1,-1), BLUE_DARK), ('TOPPADDING', (0,0), (-1,-1), 2), ('BOTTOMPADDING', (0,0), (-1,-1), 2)])],
        [Table([
            [Paragraph("Trip Corridor: <b>AR -> MO -> IL -> IN</b>", styles['WCardBody']),
             Paragraph("Route Validation: <font color='#059669'><b>VALID ADJACENT ROUTE (Border Crossings Verified)</b></font>", styles['WCardBody'])],
            [Paragraph("Tractor: <b>Unit 101</b> | Start Odo: <b>124,500</b> | End Odo: <b>125,150</b> | Distance: <b>650.0 mi</b>", styles['WCardBody'])]
        ], colWidths=[260, 260], style=[
            ('BACKGROUND', (0,0), (-1,-1), LIGHT_BG),
            ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
            ('TOPPADDING', (0,0), (-1,-1), 2),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ])]
    ], colWidths=[540], style=[('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR)])

    render_screen_spec(
        screen_id="SCR-10",
        screen_name="Sequential Trip Routing & Border Validator",
        route="/trips",
        access_tier="Authenticated Carrier / Log Auditor",
        entry_point="Clicked 'Trip Entry' tab in top navigation.",
        purpose_text="Logs sequential commercial corridors with start/end odometers and uses a Breadth-First Search (BFS) US/Canadian border adjacency graph to validate geographic continuity.",
        wireframe_flowable=wf_scr10,
        action_matrix_data=[
            ["Unit Number Selector", "Select Dropdown", "Change", "Selects power unit from registered fleet."],
            ["Corridor State Sequence", "Tag Input", "Type", "Enters sequence of states traversed (e.g. AR, MO, IL, IN)."],
            ["Validate Route CTA", "Action Button", "Click", "Runs BFS graph search in backend; verifies borders touch geographically."],
            ["Start & End Odometers", "Numeric Inputs", "Type", "Calculates total trip distance; verifies continuity against prior trip."],
            ["Commit Trip to Mileage", "Primary Submit CTA", "Click", "Disaggregates state segment miles into active mileage records."],
        ],
        next_destination_text="Valid route -> saves trip segments; Invalid route -> warns user of non-adjacent gap (e.g. TX to NY without intermediate states)."
    )

    # =========================================================================
    # SCREEN 11: STANDALONE IFTA TAX ESTIMATOR SANDBOX
    # =========================================================================
    wf_scr11 = Table([
        [Table([
            [Paragraph("Standalone IFTA Tax Estimator Sandbox", styles['WCardTitle']),
             Paragraph("Instant Estimate Without Logging Data", styles['WNavLinks'])]
        ], colWidths=[300, 220], style=[('BACKGROUND', (0,0), (-1,-1), BLUE_DARK), ('TOPPADDING', (0,0), (-1,-1), 2), ('BOTTOMPADDING', (0,0), (-1,-1), 2)])],
        [Table([
            [Paragraph("Total Fleet Distance (mi): <b>10,000</b>", styles['WCardBody']),
             Paragraph("Total Fuel Gallons (gal): <b>1,666.7</b>", styles['WCardBody']),
             Paragraph("Calculated Fleet MPG: <b>6.00 MPG</b>", styles['WCardBody'])],
            [Paragraph("Simulated Jurisdiction: <b>TX (Texas)</b> | Taxable Miles: <b>4,000 mi</b> | Tax-Paid Fuel: <b>500 gal</b>", styles['WCardBody'])],
            [Paragraph("Estimated IFTA Liability for TX: <font color='#1E3A8A'><b>$33.34 Net Tax Due</b></font>", styles['WCardBody'])],
        ], colWidths=[170, 170, 180], style=[
            ('BACKGROUND', (0,0), (-1,-1), LIGHT_BG),
            ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
            ('TOPPADDING', (0,0), (-1,-1), 2),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ])]
    ], colWidths=[540], style=[('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR)])

    render_screen_spec(
        screen_id="SCR-11",
        screen_name="Standalone IFTA Tax Estimator Sandbox",
        route="/calculator",
        access_tier="Public / Authenticated",
        entry_point="Clicked 'Quick Calculator' tab in Navbar or Landing Page link.",
        purpose_text="Interactive tax projection sandbox. Allows dispatchers to simulate tax scenarios, test MPG variations, and forecast liability prior to official quarter filing.",
        wireframe_flowable=wf_scr11,
        action_matrix_data=[
            ["Fleet Total Miles Field", "Numeric Input", "Type", "Enters estimated total fleet miles across all states."],
            ["Fleet Total Gallons Field", "Numeric Input", "Type", "Enters total fuel purchases."],
            ["State Selection Grid", "Multi-Row Selector", "Change", "Inputs state miles and tax-paid fuel."],
            ["Instant Tax Calculation", "Computed Metric", "Auto-update", "Applies current quarter tax rates and displays projected net tax due."],
            ["Transfer to Filing CTA", "Action Button", "Click", "Pre-fills draft filing with simulated values."],
        ],
        next_destination_text="Simulate scenario -> displays instant figures; Transfer -> loads into draft filing."
    )

    # =========================================================================
    # SCREEN 12: IFTA SCHEDULE 1 TAX SUMMARY & FILING FREEZE
    # =========================================================================
    wf_scr12 = Table([
        [Table([
            [Paragraph("IFTA Quarterly Fuel Use Tax Return — Schedule 1 Summary", styles['WCardTitle']),
             Paragraph("Export PDF | Export CSV | Lock Filing Quarter", styles['WNavLinks'])]
        ], colWidths=[300, 220], style=[('BACKGROUND', (0,0), (-1,-1), BLUE_DARK), ('TOPPADDING', (0,0), (-1,-1), 2), ('BOTTOMPADDING', (0,0), (-1,-1), 2)])],
        [Table([
            [Paragraph("State", styles['WTableHeader']), Paragraph("Total Miles", styles['WTableHeader']), Paragraph("Taxable Miles", styles['WTableHeader']), Paragraph("Taxable Gal", styles['WTableHeader']), Paragraph("Paid Gal", styles['WTableHeader']), Paragraph("Net Gal", styles['WTableHeader']), Paragraph("Tax Rate", styles['WTableHeader']), Paragraph("Tax Due ($)", styles['WTableHeader'])],
            [Paragraph("AR", styles['WTableCell']), Paragraph("1,200.0", styles['WTableCell']), Paragraph("1,200.0", styles['WTableCell']), Paragraph("204", styles['WTableCell']), Paragraph("200.0", styles['WTableCell']), Paragraph("4.0", styles['WTableCell']), Paragraph("$0.2850", styles['WTableCell']), Paragraph("$1.14", styles['WTableCell'])],
            [Paragraph("TX", styles['WTableCell']), Paragraph("2,620.0", styles['WTableCell']), Paragraph("2,620.0", styles['WTableCell']), Paragraph("446", styles['WTableCell']), Paragraph("450.0", styles['WTableCell']), Paragraph("-4.0", styles['WTableCell']), Paragraph("$0.2000", styles['WTableCell']), Paragraph("-$0.80", styles['WTableCell'])],
            [Paragraph("KY *", styles['WTableCell']), Paragraph("800.0", styles['WTableCell']), Paragraph("800.0", styles['WTableCell']), Paragraph("136", styles['WTableCell']), Paragraph("100.0", styles['WTableCell']), Paragraph("36.0", styles['WTableCell']), Paragraph("$0.2200", styles['WTableCell']), Paragraph("$44.92 *", styles['WTableCell'])],
        ], colWidths=[40, 70, 70, 65, 65, 55, 65, 110], style=[
            ('BACKGROUND', (0,0), (-1,0), NAVY),
            ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
            ('TOPPADDING', (0,0), (-1,-1), 2),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, LIGHT_BG]),
        ])],
        [Table([
            [Paragraph("Total Fleet Tax Due: <b>$45.26</b> | Total Miles: <b>4,620.0 mi</b> | Total Fuel: <b>750.0 gal</b> | Fleet MPG: <b>5.88</b>", styles['WCardBody'])]
        ], colWidths=[540], style=[('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#EFF6FF")), ('TOPPADDING', (0,0), (-1,-1), 2), ('BOTTOMPADDING', (0,0), (-1,-1), 2)])]
    ], colWidths=[540], style=[('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR)])

    render_screen_spec(
        screen_id="SCR-12",
        screen_name="IFTA Schedule 1 Tax Return Summary & Filing Freeze",
        route="/summary",
        access_tier="Authenticated Carrier / Tax Compliance Officer",
        entry_point="Clicked 'Schedule 1 Tax Summary' in navigation or workflow Step 3.",
        purpose_text="The authoritative 17-column ProMiles-style IFTA Schedule 1 Return table. Computes fleet MPG, state taxable gallons, net taxable gallons, surcharges, and total balance due. Features 1-click filing freeze.",
        wireframe_flowable=wf_scr12,
        action_matrix_data=[
            ["Schedule 1 17-Column Table", "Data Grid", "View", "Aggregates mileage and fuel by state; computes commercial ROUND_HALF_UP tax balances."],
            ["Export Landscape PDF CTA", "Download CTA", "Click", "Calls /api/reports/export-pdf. Streams official print-ready PDF return."],
            ["Export Schedule 1 CSV", "Download CTA", "Click", "Calls /api/reports/export-schedule1-csv. Exports full mathematical schedule."],
            ["Export State DMV EDI/CSV", "Download CTA", "Click", "Calls /api/reports/export-efile-csv. Exports direct DMV e-file format."],
            ["Finalize & Lock Quarter CTA", "Security Action CTA", "Click", "Freezes quarter data, generates 4-year audit ZIP, prevents edits."],
            ["Unlock Quarter Button", "Administrative Action", "Click", "Requires admin override to unfreeze quarter for amendments."],
        ],
        next_destination_text="Export actions download files; Lock quarter freezes filing and generates 4-year audit defense package."
    )

    # =========================================================================
    # SCREEN 13: STATE-WISE UNIT SUMMARY & PDF EXPORT
    # =========================================================================
    wf_scr13 = Table([
        [Table([
            [Paragraph("Detailed State-Wise Unit Summary Report & PDF Generator", styles['WCardTitle']),
             Paragraph("Export Unit PDF | Export Full Fleet PDF", styles['WNavLinks'])]
        ], colWidths=[320, 200], style=[('BACKGROUND', (0,0), (-1,-1), BLUE_DARK), ('TOPPADDING', (0,0), (-1,-1), 2), ('BOTTOMPADDING', (0,0), (-1,-1), 2)])],
        [Table([
            [Paragraph("Filter Unit: <b>Unit 101</b>", styles['WCardBody']),
             Paragraph("State: <b>ALL</b>", styles['WCardBody']),
             Paragraph("Date: <b>2026-01-01 to 2026-03-31</b>", styles['WCardBody']),
             Paragraph("Quarter: <b>2026-Q1</b>", styles['WCardBody'])]
        ], colWidths=[130, 110, 180, 120], style=[
            ('BACKGROUND', (0,0), (-1,-1), LIGHT_BG),
            ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
            ('TOPPADDING', (0,0), (-1,-1), 2),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ])],
        [Table([
            [Paragraph("Unit #", styles['WTableHeader']), Paragraph("State", styles['WTableHeader']), Paragraph("Total Mi", styles['WTableHeader']), Paragraph("Taxable Mi", styles['WTableHeader']), Paragraph("Fuel (Gal)", styles['WTableHeader']), Paragraph("Purchases ($)", styles['WTableHeader']), Paragraph("Taxable Gal", styles['WTableHeader']), Paragraph("Est. Tax Due", styles['WTableHeader'])],
            [Paragraph("Unit 101", styles['WTableCell']), Paragraph("AR", styles['WTableCell']), Paragraph("1,200.0", styles['WTableCell']), Paragraph("1,200.0", styles['WTableCell']), Paragraph("200.0", styles['WTableCell']), Paragraph("$720.00", styles['WTableCell']), Paragraph("204", styles['WTableCell']), Paragraph("$1.14", styles['WTableCell'])],
            [Paragraph("Unit 101", styles['WTableCell']), Paragraph("TX", styles['WTableCell']), Paragraph("800.0", styles['WTableCell']), Paragraph("800.0", styles['WTableCell']), Paragraph("140.0", styles['WTableCell']), Paragraph("$490.00", styles['WTableCell']), Paragraph("136", styles['WTableCell']), Paragraph("-$0.80", styles['WTableCell'])],
        ], colWidths=[55, 45, 65, 65, 65, 80, 75, 90], style=[
            ('BACKGROUND', (0,0), (-1,0), NAVY),
            ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
            ('TOPPADDING', (0,0), (-1,-1), 2),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, LIGHT_BG]),
        ])]
    ], colWidths=[540], style=[('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR)])

    render_screen_spec(
        screen_id="SCR-13",
        screen_name="Vehicle State-Wise Unit Summary & PDF Export",
        route="/unit-summary",
        access_tier="Authenticated Carrier / Fleet Auditor",
        entry_point="Clicked 'Unit Summary' tab in top navigation.",
        purpose_text="Vehicle-level reporting drill-down. Filters state metrics by Power Unit, Jurisdiction, and Date Range. Features 1-click landscape PDF generation via ReportLab.",
        wireframe_flowable=wf_scr13,
        action_matrix_data=[
            ["Power Unit Filter Dropdown", "Select Dropdown", "Change", "Filters breakdown for a specific truck (e.g. Unit 101) or All Units."],
            ["State / Jurisdiction Filter", "Select Dropdown", "Change", "Filters records by individual jurisdiction (e.g. TX, AR, IL)."],
            ["Date Range Selectors", "Date Inputs", "Change", "Restricts unit metrics to specific start and end trip dates."],
            ["Export Unit PDF Button", "Download CTA", "Click", "Calls /api/reports/export-unit-summary-pdf. Generates landscape PDF."],
            ["Export Unit CSV Button", "Download CTA", "Click", "Calls /api/reports/export-unit-summary-csv. Exports CSV summary."],
        ],
        next_destination_text="Filter changes update table live; Export PDF generates landscape compliance document."
    )

    # =========================================================================
    # SCREEN 14: 58-JURISDICTION IFTA TAX RATE MATRIX & SYNC
    # =========================================================================
    wf_scr14 = Table([
        [Table([
            [Paragraph("58-Jurisdiction IFTA Tax Rate Matrix & External Sync", styles['WCardTitle']),
             Paragraph("Export Rate CSV | Upload IFTA Sheet | Connect API", styles['WNavLinks'])]
        ], colWidths=[300, 220], style=[('BACKGROUND', (0,0), (-1,-1), BLUE_DARK), ('TOPPADDING', (0,0), (-1,-1), 2), ('BOTTOMPADDING', (0,0), (-1,-1), 2)])],
        [Table([
            [Paragraph("Jurisdiction", styles['WTableHeader']), Paragraph("Fuel", styles['WTableHeader']), Paragraph("Base Diesel Rate", styles['WTableHeader']), Paragraph("Surcharge", styles['WTableHeader']), Paragraph("Weight-Mile Rate", styles['WTableHeader']), Paragraph("Effective Date", styles['WTableHeader']), Paragraph("Version / Source", styles['WTableHeader']), Paragraph("Action", styles['WTableHeader'])],
            [Paragraph("AR (Arkansas)", styles['WTableCell']), Paragraph("DIESEL", styles['WTableCell']), Paragraph("$0.2850 / gal", styles['WTableCell']), Paragraph("$0.0000", styles['WTableCell']), Paragraph("$0.0000 / mi", styles['WTableCell']), Paragraph("2026-01-01", styles['WTableCell']), Paragraph("v2026.1 (IFTA Inc.)", styles['WTableCell']), Paragraph("Edit", styles['WTableCell'])],
            [Paragraph("CA (California)", styles['WTableCell']), Paragraph("DIESEL", styles['WTableCell']), Paragraph("$0.9710 / gal", styles['WTableCell']), Paragraph("$0.0000", styles['WTableCell']), Paragraph("$0.0000 / mi", styles['WTableCell']), Paragraph("2026-01-01", styles['WTableCell']), Paragraph("v2026.1 (IFTA Inc.)", styles['WTableCell']), Paragraph("Edit", styles['WTableCell'])],
            [Paragraph("KY (Kentucky)", styles['WTableCell']), Paragraph("DIESEL", styles['WTableCell']), Paragraph("$0.2200 / gal", styles['WTableCell']), Paragraph("$0.1050", styles['WTableCell']), Paragraph("$0.0285 / mi", styles['WTableCell']), Paragraph("2026-01-01", styles['WTableCell']), Paragraph("v2026.1 (IFTA Inc.)", styles['WTableCell']), Paragraph("Edit", styles['WTableCell'])],
        ], colWidths=[80, 45, 80, 55, 80, 65, 95, 40], style=[
            ('BACKGROUND', (0,0), (-1,0), NAVY),
            ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
            ('TOPPADDING', (0,0), (-1,-1), 2),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, LIGHT_BG]),
        ])]
    ], colWidths=[540], style=[('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR)])

    render_screen_spec(
        screen_id="SCR-14",
        screen_name="58-Jurisdiction IFTA Tax Rate Matrix & Multi-Source Sync",
        route="/rates",
        access_tier="Authenticated Carrier / Tax Administrator",
        entry_point="Clicked '58 Rates Matrix' tab in top navigation.",
        purpose_text="Maintains official IFTA tax rates, surcharges, and weight-mile rates across all 58 member jurisdictions. Supports bulk CSV/Excel upload, external JSON/CSV API synchronization, and single-state inline editing.",
        wireframe_flowable=wf_scr14,
        action_matrix_data=[
            ["Export 58 Matrix CSV CTA", "Download Link", "Click", "Calls /api/rates/export-csv. Downloads standardized rate template."],
            ["Upload IFTA CSV/Excel Modal", "Modal Trigger CTA", "Click", "Opens file upload modal to bulk update 58 state rates via spreadsheet."],
            ["Connect External API Sync", "Modal Trigger CTA", "Click", "Fetches latest rates from an external HTTP JSON/CSV feed."],
            ["Edit State Rate Action", "Table Action CTA", "Click", "Opens single-jurisdiction modal to edit base rate, surcharge, or effective date."],
            ["Quarter Rate Filter", "Select Dropdown", "Change", "Switches rate view across historical quarters (e.g. 2026-Q1, 2025-Q4)."],
        ],
        next_destination_text="Rate updates instantly recalculate open filings; CSV export streams template."
    )

    # =========================================================================
    # SCREEN 15: 4-YEAR AUDIT DEFENSE PACKAGE & COMPLIANCE VAULT
    # =========================================================================
    wf_scr15 = Table([
        [Table([
            [Paragraph("4-Year IFTA Audit Defense Package & Compliance Vault", styles['WCardTitle']),
             Paragraph("Statutory Retention: 4 Years (16 Quarters)", styles['WNavLinks'])]
        ], colWidths=[320, 200], style=[('BACKGROUND', (0,0), (-1,-1), BLUE_DARK), ('TOPPADDING', (0,0), (-1,-1), 2), ('BOTTOMPADDING', (0,0), (-1,-1), 2)])],
        [Table([
            [Paragraph("Filing Quarter: <b>2026-Q1</b>", styles['WCardBody']),
             Paragraph("Lock Date: <b>2026-04-15 14:22:01 UTC</b>", styles['WCardBody']),
             Paragraph("Archive Hash: <b>SHA-256 Verified</b>", styles['WCardBody'])],
            [Paragraph("Bundled Deliverables in Audit Defense Package:", styles['WCardTitle'])],
            [Paragraph("• Official Landscape IFTA Schedule 1 Return (PDF)<br/>"
                       "• Complete 58-Jurisdiction Schedule 1 Tax Table (CSV)<br/>"
                       "• State DMV / Department of Revenue Electronic Upload Package (EDI/CSV)<br/>"
                       "• State-Wise Vehicle Unit Summary Report (CSV & PDF)<br/>"
                       "• Raw Ingested Mileage Data with Normalization Logs (CSV)<br/>"
                       "• Raw Ingested Fuel Purchases with Tax-Paid Flags (CSV)<br/>"
                       "• Cryptographic Quarter Lock Snapshot & User Audit Trail Log", styles['WCardBody'])],
            [Table([[Paragraph("<b>Download Complete 4-Year Audit Defense Package (.ZIP)</b>", styles['WBtnBlue'])]], colWidths=[340], style=[
                ('BACKGROUND', (0,0), (-1,-1), ACCENT_BLUE),
                ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                ('TOPPADDING', (0,0), (-1,-1), 3),
                ('BOTTOMPADDING', (0,0), (-1,-1), 3),
            ])]
        ], colWidths=[520], style=[('BACKGROUND', (0,0), (-1,-1), LIGHT_BG), ('TOPPADDING', (0,0), (-1,-1), 3)])]
    ], colWidths=[540], style=[('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR)])

    render_screen_spec(
        screen_id="SCR-15",
        screen_name="4-Year Audit Defense Package & Compliance Vault",
        route="/audit-vault",
        access_tier="Authenticated Carrier / Tax Compliance Officer / State Auditor",
        entry_point="Triggered upon finalizing/locking a quarter or clicking 'Audit Defense Vault' in reports.",
        purpose_text="Generates and stores the complete statutory 4-year audit defense ZIP package. Bundles landscape PDF returns, CSV spreadsheets, raw ELD/fuel files, odometer continuity logs, and rate snapshots for state audit defense.",
        wireframe_flowable=wf_scr15,
        action_matrix_data=[
            ["Download Audit ZIP CTA", "Primary Download CTA", "Click", "Calls /api/reports/export-audit-zip. Streams full audit archive."],
            ["View Audit Trail Log", "Table Action CTA", "Click", "Inspects chronological user actions, import timestamps, and filing freeze records."],
            ["Verify Archive Integrity", "Cryptographic Action", "Click", "Computes SHA-256 hash of archived bundle against locked snapshot."],
            ["Print Return Summary", "Print CTA", "Click", "Opens print preview of official Schedule 1 return."],
            ["Return to Dashboard", "Navigation CTA", "Click", "Returns to main executive fleet dashboard."],
        ],
        next_destination_text="Download ZIP streams .zip archive; Return routes to /dashboard."
    )

    doc.build(story, canvasmaker=NumberedCanvasWorkflow)
    print(f"Complete Application Workflow & Screen Specification PDF generated at: {filename}")

if __name__ == "__main__":
    out_path = sys.argv[1] if len(sys.argv) > 1 else "FuelTaxPulse_Application_Workflow_and_Screen_Specification.pdf"
    build_workflow_pdf(out_path)
