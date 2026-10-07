document.addEventListener("DOMContentLoaded", function () {
    let files = [];
    let draggedIndex = null;

    const fileInput = document.getElementById("fileInput");
    const dropZone = document.getElementById("dropZone");
    const fileList = document.getElementById("fileList");
    const combineButton = document.getElementById("combineButton");
    const clearButton = document.getElementById("clearButton");
    const outputName = document.getElementById("outputName");
    const message = document.getElementById("message");
    const progressContainer = document.getElementById("progressContainer");
    const progressBar = document.getElementById("progressBar");
    const fileSummary = document.getElementById("fileSummary");

   // Browse Files button
    browseButton.addEventListener("click", function () {
        fileInput.click();
    });
    
    
    // -----------------------------
// File selection
// -----------------------------

fileInput.addEventListener("change", function (event) {
    const selectedFiles = event.target.files;

    console.log("Files selected:", selectedFiles);

    if (!selectedFiles || selectedFiles.length === 0) {
        return;
    }

    addFiles(selectedFiles);
});


// -----------------------------
// Add files
// -----------------------------

async function addFiles(selectedFiles) {

    console.log("addFiles called");

    const pdfFiles = Array.from(selectedFiles).filter(function (file) {

        console.log(
            "Checking file:",
            file.name,
            file.type,
            file.size
        );

        return (
            file.type === "application/pdf" ||
            file.name.toLowerCase().endsWith(".pdf")
        );
    });

    console.log("PDF files found:", pdfFiles);

    if (pdfFiles.length === 0) {
        showMessage("Please select PDF files.", "error");
        return;
    }

    pdfFiles.forEach(function (file) {
        files.push({
            file: file,
            pages: null
        });
    });

    console.log("Files array:", files);

    await renderFiles();
}

    // Drag and drop
    dropZone.addEventListener("dragover", function (event) {
        event.preventDefault();
        dropZone.classList.add("dragover");
    });

    dropZone.addEventListener("dragleave", function () {
        dropZone.classList.remove("dragover");
    });

    dropZone.addEventListener("drop", function (event) {
        event.preventDefault();
        dropZone.classList.remove("dragover");

        addFiles(event.dataTransfer.files);
    });


    async function renderFiles() {
        fileList.innerHTML = "";

        if (files.length === 0) {
            fileList.innerHTML =
                '<div class="empty-state">No PDF files selected.</div>';

            updateSummary();
            return;
        }

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            const row = document.createElement("div");
            row.className = "file-row";
            row.draggable = true;
            row.dataset.index = i;

            const handle = document.createElement("div");
            handle.className = "drag-handle";
            handle.textContent = "☷";

            const icon = document.createElement("div");
            icon.className = "pdf-icon";
            icon.textContent = "PDF";

            const info = document.createElement("div");
            info.className = "file-info";

            const name = document.createElement("div");
            name.className = "file-name";
            name.textContent = file.name;

            const details = document.createElement("div");
            details.className = "file-details";

            let pageCount = "?";

            try {
                const bytes = await file.arrayBuffer();
                const pdf = await PDFLib.PDFDocument.load(bytes);
                pageCount = pdf.getPageCount();
            } catch (error) {
                console.error("Could not read PDF:", error);
            }

            details.textContent =
                formatFileSize(file.size) +
                " • " +
                pageCount +
                " page" +
                (pageCount === 1 ? "" : "s");

            info.appendChild(name);
            info.appendChild(details);

            const removeButton = document.createElement("button");
            removeButton.className = "remove-file";
            removeButton.type = "button";
            removeButton.textContent = "×";
            removeButton.title = "Remove file";

            removeButton.addEventListener("click", function () {
                files.splice(i, 1);
                renderFiles();
            });

            row.appendChild(handle);
            row.appendChild(icon);
            row.appendChild(info);
            row.appendChild(removeButton);

            row.addEventListener("dragstart", function () {
                draggedIndex = i;
                row.classList.add("dragging");
            });

            row.addEventListener("dragend", function () {
                draggedIndex = null;
                row.classList.remove("dragging");
            });

            row.addEventListener("dragover", function (event) {
                event.preventDefault();
            });

            row.addEventListener("drop", function (event) {
                event.preventDefault();

                if (draggedIndex === null || draggedIndex === i) {
                    return;
                }

                const movedFile = files.splice(draggedIndex, 1)[0];
                files.splice(i, 0, movedFile);

                renderFiles();
            });

            fileList.appendChild(row);
        }

        updateSummary();
    }

    function updateSummary() {
        if (files.length === 0) {
            fileSummary.textContent = "No files selected";
        } else {
            fileSummary.textContent =
                files.length +
                " PDF" +
                (files.length === 1 ? "" : "s") +
                " selected";
        }

        combineButton.disabled = files.length === 0;
        clearButton.disabled = files.length === 0;
    }

    clearButton.addEventListener("click", function () {
        files = [];
        renderFiles();
        hideMessage();
    });

    combineButton.addEventListener("click", combinePDFs);

    async function combinePDFs() {
        if (files.length === 0) {
            showMessage("Please select at least one PDF.", "error");
            return;
        }

        combineButton.disabled = true;
        progressContainer.style.display = "block";
        progressBar.style.width = "0%";
        hideMessage();

        try {
            const mergedPdf = await PDFLib.PDFDocument.create();

            for (let i = 0; i < files.length; i++) {
                const file = files[i];

                const bytes = await file.arrayBuffer();

                const sourcePdf =
                    await PDFLib.PDFDocument.load(bytes);

                const pages = await mergedPdf.copyPages(
                    sourcePdf,
                    sourcePdf.getPageIndices()
                );

                pages.forEach(function (page) {
                    mergedPdf.addPage(page);
                });

                const percent = Math.round(
                    ((i + 1) / files.length) * 100
                );

                progressBar.style.width = percent + "%";
            }

            const pdfBytes = await mergedPdf.save();

            const blob = new Blob([pdfBytes], {
                type: "application/pdf"
            });

            let filename = outputName.value.trim();

            if (!filename) {
                filename = "Combined PDF";
            }

            if (!filename.toLowerCase().endsWith(".pdf")) {
                filename += ".pdf";
            }

            const url = URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.href = url;
            link.download = filename;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            URL.revokeObjectURL(url);

            showMessage(
                "Your PDFs have been combined successfully.",
                "success"
            );

        } catch (error) {
            console.error(error);

            showMessage(
                "There was a problem combining the PDFs. Make sure the files are valid PDF documents.",
                "error"
            );
        }

        combineButton.disabled = false;
    }

    function showMessage(text, type) {
        message.textContent = text;
        message.className = "message " + type;
        message.style.display = "block";
    }

    function hideMessage() {
        message.style.display = "none";
        message.textContent = "";
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) {
            return bytes + " B";
        }

        if (bytes < 1024 * 1024) {
            return (bytes / 1024).toFixed(1) + " KB";
        }

        return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    }

    renderFiles();
});
