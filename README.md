# fmcui - Apple Foundational Models Chat UI

fmcui is a beautiful, highly-performant chat interface built specifically to interact with **Apple Foundation Models**. It brings native-feeling chat experiences directly to your desktop.

<div align="center">
  <img width="48%" alt="Screenshot 2026-09-22 at 12 46 18 AM" src="https://github.com/user-attachments/assets/8c35b1bf-534b-44b5-bdcc-b2b8a530a2aa" />
  <img width="48%" alt="Screenshot 2026-09-22 at 12 46 03 AM" src="https://github.com/user-attachments/assets/af346df1-cc80-4bf6-8dc4-ae31d89e405b" />
</div>

🌍 **[Visit the fmcui Landing Page](https://suyash-03.github.io/fmcui-product-portfolio/)**

## Requirements

> [!WARNING]
> **macOS 27 (Golden Gate)** or above is strictly required for this application to function. 
> The underlying architecture relies heavily on system-level APIs introduced in macOS 27 to communicate optimally with Apple Foundation Models.

## Architecture

fmcui is built using a modern desktop web architecture:
- **Frontend**: React + TypeScript + Vite, styled for maximum performance and native aesthetics.
- **Backend/Desktop Integration**: Electron, ensuring deep integration with macOS 27 windowing and system status APIs.
- **Model Server**: Connects to the local `Apple Foundation Models Serve` endpoint running on loopback (`http://127.0.0.1:62437`), ensuring all chats remain completely local and private.

## Benefits

- **100% Local & Private**: No data leaves your machine. Your chats with the foundation model run entirely on-device.
- **Native macOS Feel**: Designed to blend seamlessly with the aesthetic of macOS Golden Gate, using translucent window treatments and native controls.
- **Lightning Fast Response**: Optimized streaming architecture means you see tokens as they are generated with virtually zero latency.
- **System Resource Monitoring**: Keep an eye on system resources and Apple Silicon Neural Engine utilization in real time.

## Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
