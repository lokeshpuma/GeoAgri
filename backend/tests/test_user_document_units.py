"""
Unit Tests for User Document Units, PDF, Word-Boundaries, and Sessions (PRD v2.1 M19).
Verifies:
- Unit conversion ('2 acres 20 guntas' => 0.9713 ha ±0.001, ha, acres, guntas).
- Cross-session isolation (Session B cannot access Session A record).
- In-memory PDF document parsing via pypdf.
- Word-boundary matching (e.g. 'farewell/dwelling' does not trigger 'well').
- Unmapped term yields UNKNOWN without silent defaults.
"""
import io
import pytest
import pypdf

from app.services.landrecords.user_document import (
    UserDocumentProvider,
    parse_extent_to_ha,
    _SESSION_DOCUMENT_STORE
)
from app.services.landrecords.base import SurveyRef


def test_extent_unit_conversions():
    """Validates extent extraction and conversions across acres, guntas, and hectares."""
    # PRD M19 exact gate: '2 acres 20 guntas' => 0.9713 ha ±0.001
    val1 = parse_extent_to_ha("Survey No 52, total extent 2 acres 20 guntas in cultivation.")
    assert val1 == pytest.approx(0.9713, abs=0.001)

    # Standard hectare format
    val2 = parse_extent_to_ha("Plot area is 2.50 ha recorded in pahani.")
    assert val2 == 2.50

    # 40 guntas = 1 acre = ~0.4047 ha
    val3 = parse_extent_to_ha("Extent: 40 guntas")
    assert val3 == pytest.approx(0.4047, abs=0.001)

    # 5 acres = 5 * 0.404686 = 2.0234 ha
    val4 = parse_extent_to_ha("Land area 5 acres")
    assert val4 == pytest.approx(2.0234, abs=0.001)


def test_cross_session_isolation():
    """Asserts that Session B cannot read records uploaded in Session A."""
    _SESSION_DOCUMENT_STORE.clear()

    doc_text = "Survey No: 99/A, Hissa: 1, Extent: 1.5 ha, Bagayat, Canal irrigation."
    token_a, rec_a = UserDocumentProvider.parse_document_content(
        doc_text,
        filename="rtc_session_a.txt",
        session_id="session_alpha"
    )

    prov_a = UserDocumentProvider(session_id="session_alpha")
    prov_b = UserDocumentProvider(session_id="session_beta")

    # Session A finds the record
    import asyncio
    found_a = asyncio.run(prov_a.by_reference(SurveyRef(survey_number="99/A")))
    assert found_a is not None
    assert found_a.survey_number == "99/A"

    # Session B cannot see Session A's record
    found_b = asyncio.run(prov_b.by_reference(SurveyRef(survey_number="99/A")))
    assert found_b is None


def test_pypdf_parsing():
    """Generates an in-memory PDF document and verifies pypdf extraction."""
    # Build in-memory PDF using pypdf writer
    writer = pypdf.PdfWriter()
    # Create empty page and add text using standard stream
    page = writer.add_blank_page(width=300, height=300)
    
    # We write a text stream to the page
    pdf_bytes_io = io.BytesIO()
    writer.write(pdf_bytes_io)
    
    # Since writing text with pypdf directly requires canvas or reportlab,
    # let's write a standard PDF format directly with real PDF text operators:
    raw_pdf_content = (
        b"%PDF-1.4\n"
        b"1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n"
        b"2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n"
        b"3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>>>> endobj\n"
        b"4 0 obj <</Length 120>> stream\n"
        b"BT\n"
        b"/F1 12 Tf\n"
        b"100 700 Td\n"
        b"(Survey No: 182 Hissa: 4 Extent: 3.2 ha Bagayat Canal) Tj\n"
        b"ET\n"
        b"endstream\n"
        b"endobj\n"
        b"5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj\n"
        b"xref\n"
        b"0 6\n"
        b"0000000000 65535 f \n"
        b"0000000009 00000 n \n"
        b"0000000058 00000 n \n"
        b"0000000115 00000 n \n"
        b"0000000244 00000 n \n"
        b"0000000416 00000 n \n"
        b"trailer <</Size 6 /Root 1 0 R>>\n"
        b"startxref\n"
        b"485\n"
        b"%%EOF\n"
    )

    token, record = UserDocumentProvider.parse_document_content(raw_pdf_content, filename="sample.pdf")
    assert record.survey_number == "182"
    assert record.hissa_number == "4"
    assert record.recorded_extent_ha == 3.2
    assert record.class_geoagri == "AGRICULTURAL"
    assert record.irrigation_source == "canal"


def test_word_boundaries_prevent_false_positives():
    """Words like 'dwelling' or 'farewell' must not trigger 'well' irrigation source."""
    false_text = "The dwelling was inspected during the farewell ceremony. Survey No: 12."
    token, record = UserDocumentProvider.parse_document_content(false_text)
    assert record.irrigation_source is None

    true_text = "The farmer has a private borewell on Survey No: 12."
    token2, record2 = UserDocumentProvider.parse_document_content(true_text)
    assert record2.irrigation_source == "well/borewell"


def test_unmatched_term_yields_unknown_class():
    """Unmatched land terms yield UNKNOWN + unmapped_record_term, never default agricultural."""
    unmatched_text = "Survey No: 45, Extent: 1.0 ha, Classification: NonStandardUnmappedCategory123."
    token, record = UserDocumentProvider.parse_document_content(unmatched_text)
    assert record.class_geoagri == "UNKNOWN"
    assert record.recorded_use == "Unverified"
