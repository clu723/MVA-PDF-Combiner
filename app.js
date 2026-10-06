```javascript
// ============================================
// PDF COMBINER
// ============================================

let files = [];
let draggedIndex = null;


// ============================================
// ELEMENTS
// ============================================

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


// ============================================
// FILE SELECTION
// ============================================

browseButton.addEventListener("click", function () {
    fileInput.click();
});


fileInput.addEventListener("change", function () {

    if (fileInput.files.length > 0) {
        addFiles(Array.from(fileInput.files));
    }

    // Allows selecting the same file again
    fileInput.value = "";

});


// ============================================
// DRAG & DROP UPLOAD
// ============================================

dropZone.addEventListener("dragover", function (event) {

    event.preventDefault();

    dropZone.classList.add("drag-over");

});


dropZone.addEventListener("dragleave", function () {

    dropZone.classList.remove("drag-over");

});


dropZone.addEventListener("drop", function (event) {

    event.preventDefault();

    dropZone.classList.remove("drag-over");

    const droppedFiles =
        Array.from(event.dataTransfer.files);

    addFiles(droppedFiles);

});


// ============================================
// ADD FILES
// ============================================

function addFiles(newFiles) {

    hideMessage();

    const pdfFiles = newFiles.filter(function (file) {

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


// ============================================
// RENDER FILE LIST
// ============================================

async function renderFiles() {

    fileList.innerHTML = "";

    let totalPages = 0;


    for (let i = 0; i < files.length; i++) {

        const file = files[i];

        let pageCount = null;


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
                file.name,
                error
            );

        }


        const item =
            document.createElement("div");

        item.className = "file-item";

        item.draggable = true;

        item.dataset.index = i;


        // Create the file item without using
        // complicated nested template strings.

        const dragHandle =
            document.createElement("div");

        dragHandle.className = "drag-handle";
        dragHandle.textContent = "☰";


        const pdfIcon =
            document.createElement("div");

        pdfIcon.className = "pdf-icon";
        pdfIcon.textContent = "PDF";


        const fileInfo =
            document.createElement("div");

        fileInfo.className = "file-info";


        const fileName =
            document.createElement("div");

        fileName.className = "file-name";
        fileName.textContent = file.name;
        fileName.title = file.name;


        const fileDetails =
            document.createElement("div");

        fileDetails.className = "file-details";


        let pageText;

        if (pageCount === null) {

            pageText = "Page count unavailable";

        } else {

            pageText =
                pageCount === 1
                    ? "1 page"
                    : pageCount + " pages";

        }


        fileDetails.textContent =
            formatFileSize(file.size) +
            " · " +
            pageText;


        fileInfo.appendChild(fileName);
        fileInfo.appendChild(fileDetails);


        const removeButton =
            document.createElement("button");

        removeButton.type = "button";
        removeButton.className = "remove-button";
        removeButton.textContent = "×";
        removeButton.title = "Remove file";
        removeButton.setAttribute(
            "aria-label",
            "Remove " + file.name
        );


        removeButton.addEventListener(
            "click",
            function () {

                const index =
                    Number(item.dataset.index);

                files.splice(index, 1);

                renderFiles();

            }
        );


        item.appendChild(dragHandle);
        item.appendChild(pdfIcon);
        item.appendChild(fileInfo);
        item.appendChild(removeButton);


        // Drag/reorder events

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


    updateSummary(totalPages);

}


// ============================================
// UPDATE SUMMARY
// ============================================

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
            : files.length + " files";


    const pageText =
        totalPages === 1
            ? "1 page"
            : totalPages + " pages";


    fileSummary.textContent =
        fileText + " · " + pageText;

}


// ============================================
// CLEAR ALL
// ============================================

clearButton.addEventListener(
    "click",
    function () {

        files = [];

        renderFiles();

        hideMessage();

    }
);


// ============================================
// DRAG REORDERING
// ============================================

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


// ============================================
// COMBINE PDFs
// ============================================

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


    // Disable button while processing

    combineButton.disabled = true;

    combineButtonText.textContent =
        "Combining...";

    spinner.classList.remove("hidden");

    progressContainer.classList.remove(
        "hidden"
    );

    progressBar.style.width = "0%";


    try {

        // Create a new blank PDF

        const mergedPdf =
            await PDFLib.PDFDocument.create();


        // Process every PDF

        for (
            let i = 0;
            i < files.length;
            i++
        ) {

            const file = files[i];


            progressText.textContent =
                "Processing " +
                (i + 1) +
                " of " +
                files.length +
                ": " +
                file.name;


            const progress =
                Math.round(
                    (i / files.length) * 100
                );


            progressBar.style.width =
                progress + "%";


            // Read PDF

            const bytes =
                await file.arrayBuffer();


            // Load PDF

            const pdf =
                await PDFLib.PDFDocument.load(
                    bytes
                );


            // Copy all pages

            const pages =
                await mergedPdf.copyPages(
                    pdf,
                    pdf.getPageIndices()
                );


            // Add pages to new PDF

            pages.forEach(function (page) {

                mergedPdf.addPage(page);

            });


            // Give browser time to update UI

            await new Promise(function (resolve) {

                setTimeout(resolve, 0);

            });

        }


        // Save merged PDF

        progressBar.style.width = "100%";

        progressText.textContent =
            "Creating combined PDF...";


        const mergedBytes =
            await mergedPdf.save();


        // Create downloadable file

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


        // Get filename

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


        link.download = outputName;


        document.body.appendChild(link);

        link.click();

        link.remove();


        URL.revokeObjectURL(url);


        // Success

        progressText.textContent =
            "Done! Your combined PDF is ready.";


        showMessage(
            "Successfully combined " +
            files.length +
            " PDF files.",
            "success"
        );


    } catch (error) {

        console.error(
            "PDF combination error:",
            error
        );


        progressText.textContent =
            "Something went wrong.";


        showMessage(
            "Unable to combine the PDFs. " +
            "One of the files may be encrypted, " +
            "corrupted, or otherwise unsupported.",
            "error"
        );


    } finally {

        combineButton.disabled = false;

        combineButtonText.textContent =
            "Combine PDFs";

        spinner.classList.add("hidden");

    }

}


// ============================================
// MESSAGES
// ============================================

function showMessage(text, type) {

    message.textContent = text;

    message.className =
        "message " + type;

}


function hideMessage() {

    message.textContent = "";

    message.className =
        "message hidden";

}


// ============================================
// FILE SIZE
// ============================================

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
```
