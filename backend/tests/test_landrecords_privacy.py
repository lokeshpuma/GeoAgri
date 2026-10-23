"""
Unit tests for Land Records Privacy & PII Stripping (PRD v2.0 §6.4, §14.1).
Asserts that sensitive personal data (Owner name, Aadhaar, PAN, Phone, Father's name)
is completely eliminated at the parser layer and never exposed in responses or stored state.
"""
import pytest
from app.services.landrecords.user_document import UserDocumentProvider


def test_pii_strictly_excluded_from_parsed_rtc():
    """Feeds fixture RTC text laden with PII and asserts complete removal."""
    fixture_rtc_with_pii = """
    GOVERNMENT OF KARNATAKA - REVENUE DEPARTMENT
    RECORD OF RIGHTS, TENANCY AND CROPS (RTC / PAHANI)
    District: Davanagere, Taluk: Harihara, Hobli: Malebennur, Village: Komaranahalli
    Survey No: 142, Hissa No: 3B
    Total Extent: 2.75 Hectares
    Soil / Land Classification: Bagayat (Garden Land)
    Water Source: Borewell

    --- CONFIDENTIAL OWNER DETAILS (MUST BE STRIPPED) ---
    Owner Name: Ramesh Chandrasekharappa Gowda
    Father's Name: Late Chandrasekharappa
    Aadhaar Number: 4589-1234-9876
    PAN Card: ABCPG1234F
    Mobile Number: +91 98450 12345
    Bank Account: 601234567890 (State Bank of India)
    Residential Address: #45, Basaveshwara Temple Street, Harihara
    """

    doc_token, record = UserDocumentProvider.parse_document_content(fixture_rtc_with_pii, filename="sample_rtc.txt")
    record_dict = record.model_dump()

    # Assert allowed non-PII cadastral fields are successfully extracted
    assert record.survey_number == "142"
    assert record.hissa_number == "3B"
    assert record.recorded_extent_ha == 2.75
    assert record.class_geoagri == "AGRICULTURAL"
    assert record.irrigation_source == "well/borewell"
    assert record.verification == "user_provided"

    # Assert ZERO PII survives anywhere in the record structure
    dumped_str = str(record_dict).lower()
    for forbidden_pii in [
        "ramesh",
        "chandrasekharappa",
        "gowda",
        "4589",
        "9876",
        "abcpg1234f",
        "98450",
        "601234567890",
        "basaveshwara"
    ]:
        assert forbidden_pii not in dumped_str, f"PII leak detected! Found: {forbidden_pii}"
