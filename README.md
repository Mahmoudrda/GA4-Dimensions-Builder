# GA4 Custom Dimensions Manager

A web-based tool for creating and managing custom dimensions across multiple Google Analytics 4 properties. This application provides an intuitive interface for bulk creation of custom dimensions, supporting both manual entry and CSV upload methods.

## Features

- **OAuth 2.0 Authentication** - Secure login with Google Analytics Admin API access
- **Property Management** - Load and select from all GA4 properties you have access to
- **Multiple Input Methods** - Manual entry and CSV file upload
- **Duplicate Detection** - Automatically check for existing dimensions to prevent conflicts
- **Validation** - Real-time validation of dimension parameters
- **Progress Tracking** - Visual feedback during bulk operations
- **Results Reporting** - Detailed success/failure reporting for each dimension

## Prerequisites

- Google Cloud Console project with Analytics Admin API enabled
- Admin or Editor access to GA4 properties you want to manage

## Setup Instructions

### 1. Google Cloud Console Setup

1. **Create a new project** in [Google Cloud Console](https://console.cloud.google.com/)

2. **Enable the Google Analytics Admin API:**
   - Navigate to "APIs & Services" → "Library"
   - Search for "Google Analytics Admin API"
   - Click and enable the API

3. **Create OAuth 2.0 credentials:**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client IDs"
   - Select "Web application"
   - Add your domain to "Authorized JavaScript origins"
     - Example: `https://yourdomain.com`

4. **Configure OAuth consent screen:**
   - Add test users if in development mode
   - Required scope: `https://www.googleapis.com/auth/analytics.edit`

### 2. Installation

1. **Download the files:**
   - `index.html` - The main application interface
   - `ga4-manager.js` - The JavaScript application logic

2. **Update the Client ID:**
   Replace the placeholder in `ga4-manager.js`:
   ```javascript
   client_id: 'YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com'
   ```

3. **Host the files:**
   - Deploy to any web server
   - **Note:** OAuth requires HTTPS in production

## Usage

### Manual Entry
1. Click "Load Properties" and authenticate with Google
2. Select your GA4 property from the dropdown
3. Fill in the dimension details in the form
4. Click "Add Dimension" to create

### CSV Upload
1. Prepare a CSV file following the format specification below
2. Click "Choose File" and select your CSV
3. Review the parsed dimensions
4. Click "Create Custom Dimensions" to process in bulk

## CSV Format Specification

The CSV file must include these columns (case-insensitive):

| Column | Required | Description | Validation |
|--------|----------|-------------|------------|
| Display Name | Yes | Human-readable name | Max 82 characters |
| Parameter Name | Yes | API identifier | Letters, numbers, underscores; must start with letter |
| Description | No | Optional description | Max 150 characters |
| Scope | No | Dimension scope | EVENT, USER, or ITEM (defaults to EVENT) |
| GA4 Custom Dimension | No | Create flag | "true" to include, anything else to skip |

### Example CSV:
```csv
Display Name,Parameter Name,Description,Scope,GA4 Custom Dimension
Content Type,content_type,Type of content being viewed,EVENT,true
User Segment,user_segment,Marketing segment classification,USER,true
Product Category,product_category,Category of purchased product,ITEM,true
Internal Page,internal_page,Whether page is internal facing,EVENT,false
```

## Technical Details

### Architecture

- **Frontend-only application** - All code runs in the browser
- **OAuth 2.0 authentication** using Google Identity Services
- **Google Analytics Admin API v1beta** integration
- **No server-side storage** - Access tokens stored in memory only

### Key Components

- `GA4Manager` class - Main application controller
- Authentication flow with token management
- Property and dimension management
- CSV parsing and validation
- Batch processing with error handling

### API Integration

- **Base URL:** `https://analyticsadmin.googleapis.com/v1beta/`
- **Authentication:** OAuth 2.0 Bearer token
- **Key endpoints:**
  - `accounts` - List accessible accounts
  - `properties` - List properties within accounts
  - `properties/{property}/customDimensions` - Manage custom dimensions

## Limitations

1. **GA4 Limits:** Each property can have up to 50 custom dimensions
2. **API Rate Limits:** Google imposes rate limits on API calls
3. **Permissions:** Requires Admin/Editor access to GA4 properties
4. **Browser Support:** Modern browsers only (ES6+ required)
5. **HTTPS Requirement:** Production deployments must use HTTPS



## Security Considerations

- Client-side application with no server-side data storage
- Access tokens stored in memory only (not persisted)
- HTTPS required to protect OAuth flow and API communications
- Minimal necessary permissions requested
- Compliance with Google's Terms of Service required

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test it
5. Submit a pull request
