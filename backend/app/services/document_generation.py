from __future__ import annotations

from datetime import date
from pathlib import Path
from shutil import copy2

from docx import Document as DocxDocument
from docx.enum.text import WD_ALIGN_PARAGRAPH
from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.document_file import DocumentFile
from app.models.enums import DocumentFileKind, DocumentType
from app.models.user import User
from app.services.pdf import pdf_conversion_service
from app.services.storage import ensure_parent, sha256sum, storage_root


class DocumentGenerationService:
    async def regenerate_document_files(self, db: AsyncSession, document: Document, current_user: User) -> list[DocumentFile]:
        if document.type == DocumentType.ORDER:
            return await self.generate_order_docx(db, document, current_user)
        if document.type == DocumentType.INSTRUCTION:
            return await self.generate_instruction_docx(db, document, current_user)
        if document.type == DocumentType.ORDER_EXTRACT:
            return await self.generate_order_extract_docx(db, document, current_user)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Generation is not supported for this document type")

    async def generate_order_docx(self, db: AsyncSession, document: Document, current_user: User) -> list[DocumentFile]:
        return await self._generate_main_document(db, document, current_user, title_text="П Р И К А З", command_text="П Р И К А З Ы В А Ю:")

    async def generate_instruction_docx(self, db: AsyncSession, document: Document, current_user: User) -> list[DocumentFile]:
        return await self._generate_main_document(db, document, current_user, title_text="П Р И К А З А Н И Е", command_text="П Р И К А З Ы В А Ю:")

    async def generate_order_extract_docx(self, db: AsyncSession, document: Document, current_user: User) -> list[DocumentFile]:
        generated_files = await self._delete_existing_generated_files(db, document.id, {DocumentFileKind.EXTRACT_DOCX, DocumentFileKind.EXTRACT_PDF})
        _ = generated_files

        doc = DocxDocument()
        self._apply_base_style(doc)
        data = document.structured_data
        self._center_paragraph(doc, document.organization_name, bold=True)
        self._center_paragraph(doc, "В Ы П И С К А И З П Р И К А З А", bold=True, size=16)
        self._center_paragraph(doc, document.signer_position, bold=True)
        self._center_paragraph(doc, f"от {self._format_date(document.document_date or date.today())} {document.city}")
        self._body_paragraph(doc, data.get("certifier_position", ""))
        self._body_paragraph(doc, document.title, bold=True)
        for index, item in enumerate(data.get("extracted_items", []), start=1):
            self._body_paragraph(doc, f"{index}. {item}")
        self._body_paragraph(doc, "")
        self._body_paragraph(doc, f"Выписка верна: {data.get('certifier_position', '')}")
        self._body_paragraph(doc, data.get("certifier_name", ""))

        docx_path, pdf_path = self._document_paths(document)
        ensure_parent(docx_path)
        doc.save(docx_path)
        converted_pdf = pdf_conversion_service.convert_docx_to_pdf(docx_path, pdf_path.parent)
        if converted_pdf != pdf_path:
            copy2(converted_pdf, pdf_path)
            converted_pdf.unlink(missing_ok=True)

        return await self._persist_generated_files(
            db,
            document,
            current_user,
            [
                (docx_path, DocumentFileKind.EXTRACT_DOCX, True, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
                (pdf_path, DocumentFileKind.EXTRACT_PDF, True, "application/pdf"),
            ],
        )

    async def _generate_main_document(
        self,
        db: AsyncSession,
        document: Document,
        current_user: User,
        *,
        title_text: str,
        command_text: str,
    ) -> list[DocumentFile]:
        await self._delete_existing_generated_files(db, document.id, {DocumentFileKind.GENERATED_DOCX, DocumentFileKind.GENERATED_PDF})
        doc = DocxDocument()
        self._apply_base_style(doc)
        data = document.structured_data

        self._center_paragraph(doc, document.organization_name, bold=True)
        self._center_paragraph(doc, title_text, bold=True, size=16)
        number_line = document.registered_number or "без номера"
        date_line = self._format_date(document.document_date or date.today())
        self._center_paragraph(doc, f"№ {number_line} от {date_line}", bold=True)
        self._center_paragraph(doc, document.city)
        subject = data.get("order_subject") or data.get("instruction_subject") or document.title
        self._center_paragraph(doc, subject, bold=True)
        if data.get("legal_basis_text"):
            self._body_paragraph(doc, data["legal_basis_text"])
        if data.get("purpose_text"):
            self._body_paragraph(doc, data["purpose_text"])
        self._body_paragraph(doc, command_text, bold=True)
        for index, item in enumerate(data.get("order_items", data.get("instruction_items", [])), start=1):
            self._body_paragraph(doc, f"{index}. {item}")
        self._body_paragraph(doc, f"Контроль исполнения возложить на {data.get('control_assignee_text', '')}.")
        self._body_paragraph(doc, "")
        self._body_paragraph(doc, document.signer_position)
        self._body_paragraph(doc, document.signer_name)

        if document.type == DocumentType.ORDER:
            self._body_paragraph(doc, "")
            self._body_paragraph(doc, "Лист согласования", bold=True)
            for step in document.approval_steps:
                approver_name = step.approver.full_name if step.approver else f"Пользователь #{step.approver_id}"
                self._body_paragraph(doc, f"{step.step_order}. {approver_name} - {step.status.value}")
            self._body_paragraph(doc, "")
            self._body_paragraph(doc, "Лист ознакомления", bold=True)
            for ack in document.acknowledgements:
                user_name = ack.user.full_name if ack.user else f"Пользователь #{ack.user_id}"
                self._body_paragraph(doc, f"{user_name} - {ack.status.value}")

        if document.executor_name or data.get("executor_name"):
            self._body_paragraph(doc, "")
            self._body_paragraph(doc, f"Исп.: {document.executor_name or data.get('executor_name')}")
        if document.executor_phone or data.get("executor_phone"):
            self._body_paragraph(doc, f"тел. {document.executor_phone or data.get('executor_phone')}")

        docx_path, pdf_path = self._document_paths(document)
        ensure_parent(docx_path)
        doc.save(docx_path)
        converted_pdf = pdf_conversion_service.convert_docx_to_pdf(docx_path, pdf_path.parent)
        if converted_pdf != pdf_path:
            copy2(converted_pdf, pdf_path)
            converted_pdf.unlink(missing_ok=True)

        return await self._persist_generated_files(
            db,
            document,
            current_user,
            [
                (docx_path, DocumentFileKind.GENERATED_DOCX, False, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
                (pdf_path, DocumentFileKind.GENERATED_PDF, False, "application/pdf"),
            ],
        )

    async def _delete_existing_generated_files(
        self,
        db: AsyncSession,
        document_id: int,
        kinds: set[DocumentFileKind],
    ) -> None:
        result = await db.execute(select(DocumentFile).where(DocumentFile.document_id == document_id, DocumentFile.kind.in_(tuple(kinds))))
        for file_entry in result.scalars().all():
            Path(file_entry.storage_path).unlink(missing_ok=True)
        await db.execute(delete(DocumentFile).where(DocumentFile.document_id == document_id, DocumentFile.kind.in_(tuple(kinds))))
        await db.flush()

    async def _persist_generated_files(
        self,
        db: AsyncSession,
        document: Document,
        current_user: User,
        files: list[tuple[Path, DocumentFileKind, bool, str]],
    ) -> list[DocumentFile]:
        stored_files: list[DocumentFile] = []
        for path, kind, download_allowed, mime_type in files:
            file_entry = DocumentFile(
                document_id=document.id,
                version=document.current_version,
                original_filename=path.name,
                storage_path=str(path),
                mime_type=mime_type,
                size_bytes=path.stat().st_size,
                sha256=sha256sum(path),
                kind=kind,
                is_download_allowed=download_allowed,
                created_by=current_user.id,
            )
            db.add(file_entry)
            stored_files.append(file_entry)
        await db.flush()
        return stored_files

    def _document_paths(self, document: Document) -> tuple[Path, Path]:
        base = storage_root()
        doc_date = document.document_date or date.today()
        if document.type == DocumentType.ORDER_EXTRACT:
            directory = base / "extracts" / f"{doc_date.year}" / f"{doc_date.month:02d}" / str(document.id)
        else:
            directory = (
                base
                / "documents"
                / f"{doc_date.year}"
                / f"{doc_date.month:02d}"
                / str(document.id)
                / str(document.current_version)
            )
        return directory / "generated.docx", directory / "generated.pdf"

    def _apply_base_style(self, document: DocxDocument) -> None:
        style = document.styles["Normal"]
        style.font.name = "Times New Roman"
        style.font.size = None

    def _center_paragraph(self, document: DocxDocument, text: str, *, bold: bool = False, size: int = 14) -> None:
        paragraph = document.add_paragraph()
        paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = paragraph.add_run(text)
        run.bold = bold
        run.font.name = "Times New Roman"
        run.font.size = None

    def _body_paragraph(self, document: DocxDocument, text: str, *, bold: bool = False) -> None:
        paragraph = document.add_paragraph()
        run = paragraph.add_run(text)
        run.bold = bold
        run.font.name = "Times New Roman"

    def _format_date(self, value: date) -> str:
        return value.strftime("%d.%m.%Y")


document_generation_service = DocumentGenerationService()
