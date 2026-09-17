# Universal File Converter

A simple, fast, and private client-side file converter built with HTML, Tailwind CSS, and vanilla JavaScript. Convert images, PDFs, audio, and data files without ever uploading them to a server.

![Screenshot of the File Converter](https://placehold.co/800x450/1f2937/a0aec0?text=File+Converter+UI)

## ✨ Features

- **Fully Client-Side:** All processing happens in your browser. Your files are never uploaded, ensuring 100% privacy.
- **Drag & Drop:** Easily drag and drop files to upload.
- **Images:** Convert between PNG, JPEG, WEBP, BMP, ICO, and PDF, with a quality slider for lossy formats.
- **PDF:** Turn any image into a PDF, or split a PDF's pages back out into PNG/JPEG images (zipped automatically for multi-page files).
- **Data:** Convert between JSON and CSV.
- **Audio:** Convert between WAV and MP3, with a selectable MP3 bitrate.
- **Base64:** Encode *any* file to a Base64 text file, or decode one back to the original file — a fallback that works for file types not covered above.
- **Auto-Detection:** The app detects what kind of file you dropped in and only shows the conversions that make sense for it.
- **Live Previews:** See a preview of your original file and the converted result (image, audio player, or text snippet, depending on type).
- **Responsive Design:** Works beautifully on both desktop and mobile devices.

## 🚀 Live Demo

[You can add your Vercel deployment link here once it's live!]

## 🛠️ Getting Started

To run this project locally:

1.  Clone the repository:
    ```bash
    git clone [https://github.com/your-username/image-converter.git](https://github.com/your-username/image-converter.git)
    ```
2.  Navigate to the project directory:
    ```bash
    cd image-converter
    ```
3.  Serve the folder with any static file server and open it in your browser, e.g.:
    ```bash
    npx serve .
    ```
    (Opening `index.html` directly via `file://` won't work — the app uses ES modules and a PDF worker, both of which require `http(s)://`.)

## 🚀 Deployment to Vercel

Deploying this static site to Vercel is incredibly simple:

1.  **Push to GitHub:** Create a new repository on GitHub and push this project's code to it.
2.  **Import to Vercel:**
    - Sign up or log in to [Vercel](https://vercel.com).
    - Click "Add New..." -> "Project".
    - Import the Git repository you just created.
3.  **Deploy:**
    - Vercel will automatically detect it as a static site. No framework preset is needed.
    - Click the "Deploy" button.
    - That's it! Your site will be live on a public URL.

## 💻 Technologies Used

-   **HTML5**
-   **Tailwind CSS** (via CDN)
-   **Vanilla JavaScript** (ES6+, ES modules)
-   **Vendored libraries** (self-hosted in `assets/vendor/`, loaded on demand so the initial page stays light): [jsPDF](https://github.com/parallax/jsPDF), [PDF.js](https://github.com/mozilla/pdf.js), [JSZip](https://github.com/Stuk/jszip), [lamejs](https://github.com/zhuker/lamejs)

## 📁 Project Structure

```
index.html
assets/
  css/style.css
  js/
    main.js               # UI wiring, file-type detection, orchestration
    vendor-loader.js       # lazy-loads vendored <script> libraries
    converters/
      image.js             # canvas-based image conversion + BMP/ICO encoders
      pdf.js                # image<->PDF via jsPDF/PDF.js
      data.js               # JSON<->CSV, Base64 encode/decode
      audio.js              # Web Audio API decode -> WAV/MP3 encode
  vendor/                  # self-hosted third-party libraries (see above)
```
