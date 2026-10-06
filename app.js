```javascript
// ============================================
// PDF COMBINER
// Client-side PDF merging using PDF-LIB
// ============================================


// --------------------------------------------
// STATE
// --------------------------------------------

let files = [];

let draggedIndex = null;


// --------------------------------------------
// ELEMENTS
// --------------------------------------------

const dropZone = document.getElementById("dropZone");

const browseButton = document.getElementById("browseButton");

const fileInput = document.getElementById("fileInput");

const fileSection = document.getElementById("fileSection");

const optionsSection = document.getElementById("optionsSection");

const fileList = document.getElementById("fileList");

const fileSummary = document.getElementById("fileSummary");

const clearButton = document.getElementById("clearButton");

const filenameInput = document.getElementById("filename");

const combineButton = document.getElementById("combineButton");

const combineButtonText =
    document.getElementById("combineButtonText");

const spinner =
    document.getElementById("spinner");

const progressContainer =
    document.getElementById("progressContainer");

const progressBar =
    document.getElementById("progressBar");

const progressText =
    document.getElementById("progressText");

const message =
    document.getElementById("message");


// --------------------------------------------
// FILE SELECTION
// --------------------------------------------

browseButton.addEventListener("click", () => {
    fileInput.click();
});


fileInput.addEventListener("change", () => {

    if (fileInput.files.length > 0) {

        addFiles(
            Array.from(fileInput.files)
        );

    }

    // Allows selecting the same files again
    fileInput.value = "";
});


// --------------------------------------------
// DRAG & DROP
// --------------------------------------------

dropZone.addEventListener("dragover", (event) => {

    event.preventDefault();

    dropZone.classList.add("drag-over");

});


dropZone.addEventListener("dragleave", () => {

    dropZone.classList.remove("drag-over");

});


dropZone.addEventListener("drop", (event) => {

    event.preventDefault();

    dropZone.classList.remove("drag-over");

    const droppedFiles =
        Array.from(event.dataTransfer.files);

    addFiles(droppedFiles);

});


// --------------------------------------------
// ADD FILES
// --------------------------------------------

function addFiles(newFiles) {

    hideMessage();

    const pdfFiles = newFiles.filter(file => {

        return (
            file.type === "application/pdf" ||
            file.name.toLowerCase().endsWith(".pdf")
        );

    });


    if (pdfFiles.length === 0) {

        showMessage(
            "Please select PDF files.",
            "error"
        );

        return;
    }


    files.push(...pdfFiles);

    renderFiles();

}


// --------------------------------------------
// RENDER FILE LIST
// --------------------------------------------

async function renderFiles() {

    fileList.innerHTML = "";

    let totalPages = 0;


    for (let i = 0; i < files.length; i++) {

        const file = files[i];

        let pageCount = "?";


        try {

            const bytes =
                await file.arrayBuffer();

            const pdf =
                await PDFLib.PDFDocument.load(bytes);

            pageCount =
                pdf.getPageCount();

            totalPages += pageCount;

        } catch (error) {

            console.warn(
                "Could not read PDF:",
                file.name
            );

        }


        const item =
            document.createElement("div");

        item.className = "file-item";

        item.draggable = true;

        item.dataset.index = i;


        item.innerHTML = `

            <div class="drag-handle">
                ☰
            </div>

            <div class="pdf-icon">
                PDF
            </div>

            <div class="file-info">

                <div class="file-name"
                     title="${escapeHtml(file.name)}">

                    ${escapeHtml(file.name)}

                </div>

                <div class="file-details">

                    ${formatFileSize(file.size)}
                    ·
                    ${pageCount === "?"
                        ? "Page count unavailable"
                        : pageCount +
                          (pageCount === 1
                              ? " page"
                              : " pages")}

                </div>

            </div>

            <button
                type="button"
                class="remove-button"
                data-index="${i}"
                title="Remove file"
                aria-label="Remove ${escapeHtml(file.name)}"
            >
                ×
            </button>
        `;


        // Drag events

        item.addEventListener(
            "dragstart",
            handleDragStart
        );

        item.addEventListener(
            "dragover",
            handleDragOver
        );

        item.addEventListener(
            "drop",
            handleDrop
        );

        item.addEventListener(
            "dragend",
            handleDragEnd
        );


        fileList.appendChild(item);

    }


    // Remove buttons

    document
        .querySelectorAll(".remove-button")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const index =
                        Number(button.dataset.index);

                    files.splice(index, 1);

                    renderFiles();

                }
            );

        });


    updateSummary(totalPages);

}


// --------------------------------------------
// SUMMARY
// --------------------------------------------

function updateSummary(totalPages) {

    if (files.length === 0) {

        fileSection.classList.add("hidden");

        optionsSection.classList.add("hidden");

        return;

    }


    fileSection.classList.remove("hidden");

    optionsSection.classList.remove("hidden");


    const fileText =
        files.length === 1
            ? "1 file"
            : `${files.length} files`;


    const pageText =
        totalPages === 1
            ? "1 page"
            : `${totalPages} pages`;


    fileSummary.textContent =
        `${fileText} · ${pageText}`;

}


// --------------------------------------------
// CLEAR ALL
// --------------------------------------------

clearButton.addEventListener(
    "click",
    () => {

        files = [];

        renderFiles();

        hideMessage();

    }
);


// --------------------------------------------
// DRAG REORDERING
// --------------------------------------------

function handleDragStart(event) {

    draggedIndex =
        Number(event.currentTarget.dataset.index);

    event.currentTarget.classList.add(
        "dragging"
    );

}


function handleDragOver(event) {

    event.preventDefault();

}


function handleDrop(event) {

    event.preventDefault();

    const targetIndex =
        Number(event.currentTarget.dataset.index);


    if (
        draggedIndex === null ||
        draggedIndex === targetIndex
    ) {

        return;

    }


    const draggedFile =
        files[draggedIndex];


    files.splice(
        draggedIndex,
        1
    );


    files.splice(
        targetIndex,
        0,
        draggedFile
    );


    draggedIndex = null;

    renderFiles();

}


function handleDragEnd(event) {

    event.currentTarget.classList.remove(
        "dragging"
    );

    draggedIndex = null;

}


// --------------------------------------------
// COMBINE PDFs
// --------------------------------------------

combineButton.addEventListener(
    "click",
    combinePDFs
);


async function combinePDFs() {

    if (files.length === 0) {

        showMessage(
            "Please add at least one PDF.",
            "error"
        );

        return;

    }


    hideMessage();


    // UI state

    combineButton.disabled = true;

    combineButtonText.textContent =
        "Combining...";

    spinner.classList.remove("hidden");

    progressContainer.classList.remove(
        "hidden"
    );

    progressBar.style.width = "0%";


    try {

        // Create new PDF

        const mergedPdf =
            await PDFLib.PDFDocument.create();


        // Process each PDF

        for (
            let i = 0;
            i < files.length;
            i++
        ) {

            const file = files[i];


            progressText.textContent =
                `Processing ${i + 1} of ${files.length}: ${file.name}`;


            const progress =
                Math.round(
                    (i / files.length) * 100
                );


            progressBar.style.width =
                `${progress}%`;


            // Read file

            const bytes =
                await file.arrayBuffer();


            // Load PDF

            const pdf =
                await PDFLib.PDFDocument.load(
                    bytes
                );


            // Copy pages

            const pages =
                await mergedPdf.copyPages(
                    pdf,
                    pdf.getPageIndices()
                );


            pages.forEach(page => {

                mergedPdf.addPage(page);

            });


            // Allow browser to update UI

            await new Promise(
                resolve =>
                    setTimeout(resolve, 0)
            );

        }


        // Finish progress

        progressBar.style.width =
            "100%";

        progressText.textContent =
            "Creating combined PDF...";


        // Save

        const mergedBytes =
            await mergedPdf.save();


        // Create download

        const blob =
            new Blob(
                [mergedBytes],
                {
                    type: "application/pdf"
                }
            );


        const url =
            URL.createObjectURL(blob);


        const link =
            document.createElement("a");


        link.href = url;


        let outputName =
            filenameInput.value.trim();


        if (!outputName) {

            outputName = "combined.pdf";

        }


        if (
            !outputName
                .toLowerCase()
                .endsWith(".pdf")
        ) {

            outputName += ".pdf";

        }


        link.download =
            outputName;


        document.body.appendChild(link);

        link.click();

        link.remove();


        URL.revokeObjectURL(url);


        // Success

        progressText.textContent =
            "Done! Your combined PDF is ready.";


        showMessage(
            `Successfully combined ${files.length} PDF files.`,
            "success"
        );


    } catch (error) {

        console.error(error);


        progressText.textContent =
            "Something went wrong.";


        showMessage(
            "Unable to combine the PDFs. One of the files may be encrypted, corrupted, or otherwise unsupported.",
            "error"
        );


    } finally {

        combineButton.disabled = false;

        combineButtonText.textContent =
            "Combine PDFs";

        spinner.classList.add("hidden");

    }

}


// --------------------------------------------
// MESSAGE
// --------------------------------------------

function showMessage(
    text,
    type
) {

    message.textContent = text;

    message.className =
        `message ${type}`;

}


function hideMessage() {

    message.className =
        "message hidden";

    message.textContent = "";

}


// --------------------------------------------
// FILE SIZE
// --------------------------------------------

function formatFileSize(bytes) {

    if (bytes === 0) {
        return "0 Bytes";
    }


    const units = [
        "Bytes",
        "KB",
        "MB",
        "GB"
    ];


    const index =
        Math.floor(
            Math.log(bytes) /
            Math.log(1024)
        );


    return (
        parseFloat(
            (
                bytes /
                Math.pow(1024, index)
            ).toFixed(2)
        ) +
        " " +
        units[index]
    );

}


// --------------------------------------------
// HTML ESCAPING
// --------------------------------------------

function escapeHtml(value) {

    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}
```
