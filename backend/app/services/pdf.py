from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from fastapi import HTTPException, status

from app.core.config import settings


class PdfConversionService:
    def convert_docx_to_pdf(self, source_docx: Path, output_dir: Path) -> Path:
        binary = shutil.which(settings.libreoffice_binary) or settings.libreoffice_binary
        output_dir.mkdir(parents=True, exist_ok=True)
        command = [
            binary,
            "--headless",
            "--convert-to",
            "pdf",
            "--outdir",
            str(output_dir),
            str(source_docx),
        ]
        result = subprocess.run(command, capture_output=True, text=True, check=False)
        output_pdf = output_dir / f"{source_docx.stem}.pdf"
        if result.returncode != 0 or not output_pdf.exists():
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"PDF conversion failed: {(result.stderr or result.stdout).strip() or 'unknown error'}",
            )
        return output_pdf


pdf_conversion_service = PdfConversionService()
