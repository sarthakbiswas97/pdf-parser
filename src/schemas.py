"""Document type definitions and field schemas for structured extraction."""

from __future__ import annotations

DOCUMENT_TYPES: dict[str, dict] = {
    "invoice": {
        "label": "Invoice",
        "description": "Financial invoice, bill, or purchase order",
        "fields": {
            "vendor": "Company or person issuing the invoice",
            "invoice_number": "Invoice or reference number",
            "date": "Invoice date",
            "due_date": "Payment due date",
            "amount": "Total amount (include currency)",
            "tax": "Tax amount or percentage",
            "line_items": "List of items/services with quantities and prices",
        },
    },
    "resume": {
        "label": "Resume",
        "description": "Job application resume or CV",
        "fields": {
            "name": "Full name of the candidate",
            "email": "Email address",
            "phone": "Phone number",
            "location": "City or address",
            "skills": "List of technical and soft skills",
            "experience": "Work experience with company names, roles, and dates",
            "education": "Degrees, institutions, and graduation dates",
        },
    },
    "contract": {
        "label": "Contract",
        "description": "Legal agreement, NDA, or service contract",
        "fields": {
            "parties": "Names of all parties involved",
            "effective_date": "Start date of the agreement",
            "end_date": "End date or termination clause",
            "payment_terms": "Payment amount, schedule, or conditions",
            "renewal_clause": "Auto-renewal or renewal terms",
            "governing_law": "Jurisdiction or governing law",
        },
    },
    "bank_statement": {
        "label": "Bank Statement",
        "description": "Bank account statement or transaction history",
        "fields": {
            "account_holder": "Name on the account",
            "account_number": "Account or IBAN number",
            "bank_name": "Name of the bank",
            "period": "Statement period (start and end dates)",
            "opening_balance": "Balance at start of period",
            "closing_balance": "Balance at end of period",
            "transactions": "List of transactions with dates, descriptions, and amounts",
        },
    },
    "report": {
        "label": "Report",
        "description": "Research paper, business report, or analysis",
        "fields": {
            "title": "Document title",
            "author": "Author or organization",
            "date": "Publication or report date",
            "key_findings": "Main findings or conclusions",
            "recommendations": "Recommendations or next steps",
        },
    },
    "other": {
        "label": "General Document",
        "description": "Document that doesn't fit other categories",
        "fields": {
            "title": "Document title or heading",
            "author": "Author or source",
            "date": "Date if present",
            "key_content": "Main content or purpose of the document",
        },
    },
}

DOC_TYPE_LIST = list(DOCUMENT_TYPES.keys())
