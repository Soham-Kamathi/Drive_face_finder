# FaceFinder

FaceFinder is a web application that helps you locate photos of yourself in your Google Drive using advanced face recognition technology. The application processes all images locally in your browser, ensuring your privacy.

## Features

- **Smart Search**: Quickly find photos of you across thousands of images.
- **Private & Secure**: All processing happens in your browser - no data is uploaded.
- **Fast Results**: Advanced AI delivers accurate matches efficiently.
- **Easy Download**: Download all your matched photos in one click.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/facefinder.git
   cd facefinder
   ```

2. Open `index.html` in your web browser.

## Usage

1. **Sign in with Google**: Click the "Sign in with Google" button to authenticate your Google account.
2. **Select Google Drive Folder**: Choose a folder containing the photos you want to search through or enter a Google Drive folder link directly.
3. **Upload Reference Face**: Upload a clear photo of your face to use as a reference for matching.
4. **Find My Photos**: Click the "Find My Photos" button to start the search.
5. **Download Matched Photos**: After the search is complete, you can download all matched photos in a ZIP file.

## Configuration

Before using the application, make sure to replace the sensitive information in `script.js`:

```javascript
// API Keys - Replace these with your own
const API_KEY = 'YOUR_API_KEY_HERE';
const CLIENT_ID = 'YOUR_CLIENT_ID_HERE';
```

### How to Obtain API Keys

1. **Google Cloud Console**:
   - Go to the [Google Cloud Console](https://console.cloud.google.com/).
   - Create a new project or select an existing one.

2. **Enable APIs**:
   - Navigate to the "Library" section in the left sidebar.
   - Search for and enable the following APIs:
     - Google Drive API
     - Google Identity Services API

3. **Create Credentials**:
   - Go to the "Credentials" section in the left sidebar.
   - Click on "Create Credentials" and select "OAuth client ID".
   - Configure the consent screen as required.
   - Choose "Web application" as the application type.
   - Add your authorized redirect URIs (e.g., `http://localhost` for local testing).
   - After creating, you will see your `CLIENT_ID` and `CLIENT_SECRET`.

4. **API Key**:
   - In the "Credentials" section, click on "Create Credentials" and select "API key".
   - Copy the generated API key and replace `YOUR_API_KEY_HERE` in `script.js`.

## Dependencies

- [face-api.js](https://github.com/justadudewhohacks/face-api.js): A JavaScript library for face detection and recognition.
- [Google API Client Library](https://developers.google.com/api-client-library/javascript): For accessing Google Drive.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Thanks to the developers of face-api.js for their amazing work on face recognition technology.
- Special thanks to Google for providing the API to access Google Drive.
