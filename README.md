**GA4 Custom Dimensions Manager
**
A web-based tool for creating and managing custom dimensions across multiple Google Analytics 4 properties. This application provides an intuitive interface for bulk creation of custom dimensions, supporting both manual entry and CSV upload methods.

**Features**
	•	OAuth 2.0 Authentication - Secure login with Google Analytics Admin API access
	•	Property Management - Load and select from all GA4 properties you have access to
	•	Multiple Input Methods - Manual entry and CSV file upload
	•	Batch Processing - Create multiple dimensions with configurable batch sizes and delays
	•	Duplicate Detection - Automatically check for existing dimensions to prevent conflicts
	•	Validation - Real-time validation of dimension parameters
	•	Progress Tracking - Visual feedback during bulk operations
	•	Results Reporting - Detailed success/failure reporting for each dimension

**Make it your own
**
Google Cloud Console Setup
	1.	Create a new project in Google Cloud Console
	2.	Enable the Google Analytics Admin API:
	•	Navigate to “APIs & Services” → “Library”
	•	Search for “Google Analytics Admin API”
	•	Click and enable the API
	3.	Create OAuth 2.0 credentials:
	•	Go to “APIs & Services” → “Credentials”
	•	Click “Create Credentials” → “OAuth 2.0 Client IDs”
	•	Select “Web application”
	•	Add your domain to “Authorized JavaScript origins”
	•	https://yourdomain.com
	4.	Configure OAuth consent screen:
	•	Add test users if in development mode

Permissions Requirements
	•	Your Google account must have Admin or Editor access to the GA4 properties you want to manage
	•	The OAuth scope https://www.googleapis.com/auth/analytics.edit is required

Installation
	1.	Download the files:
	•	index.html - The main application interface
	•	ga4-manager.js - The JavaScript application logic
	2.	Update the Client ID:
Replace the placeholder in ga4-manager.js:

client_id: 'YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com'


	3.	Host the files
	•	Note: OAuth requires HTTPS in production 

**CSV Format Specification
**
The CSV file must include these columns (case-insensitive):

Column	Required	Description	Validation
Display Name	Yes	Human-readable name	Max 82 characters
Parameter Name	Yes	API identifier	Letters, numbers, underscores; must start with letter
Description	No	Optional description	Max 150 characters
Scope	No	Dimension scope	EVENT, USER, or ITEM (defaults to EVENT)
GA4 Custom Dimension	No	Create flag	“true” to include, anything else to skip

Example CSV:

Display Name,Parameter Name,Description,Scope,GA4 Custom Dimension
Content Type,content_type,Type of content being viewed,EVENT,true
User Segment,user_segment,Marketing segment classification,USER,true
Product Category,product_category,Category of purchased product,ITEM,true
Internal Page,internal_page,Whether page is internal facing,EVENT,false

**Code Architecture
**
Core Classes

GA4Manager Class

The main application controller handling:
	•	Google OAuth 2.0 authentication using Google Identity Services
	•	API communication with Google Analytics Admin API
	•	Token management and refresh handling

class GA4Manager {
  constructor()        // Initialize authentication system
  init()              // Set up Google APIs and OAuth client
  authenticate()      // Trigger OAuth flow
  handleAuthSuccess() // Process successful authentication
  makeApiCall()       // Wrapper for authenticated API requests
}

Key Functions

Property Management
	•	loadProperties() - Authenticate and load user’s GA4 properties
	•	getPropertiesList() - Make API calls to retrieve accounts and properties
	•	handlePropertiesLoaded() - Populate the property selection dropdown

Dimension Processing
	•	addManualDimension() - Add single dimension from form input
	•	handleFile() - Process uploaded CSV files
	•	parseCSVData() - Convert CSV data to dimension objects
	•	validateDimensions() - Check dimensions against GA4 requirements

API Operations
	•	createCustomDimensions() - Batch create dimensions with error handling
	•	getExistingCustomDimensions() - Retrieve existing dimensions for duplicate checking

Authentication Flow
	1.	Initialization: Load Google APIs and create OAuth token client
	2.	User Action: User clicks “Load Properties”
	3.	Authentication: If not authenticated, trigger OAuth consent flow
	4.	Token Handling: Store access token for API requests
	5.	API Calls: Include Bearer token in all Analytics Admin API requests
	6.	Token Refresh: Handle expired tokens with re-authentication

API Integration

The application uses the Google Analytics Admin API v1beta:
	•	Base URL: https://analyticsadmin.googleapis.com/v1beta/
	•	Authentication: OAuth 2.0 Bearer token
	•	Key Endpoints:
	•	accounts - List accessible accounts
	•	properties - List properties within accounts
	•	properties/{property}/customDimensions - Manage custom dimensions

Error Handling
	•	Authentication Errors: Clear tokens and prompt re-authentication
	•	API Errors: Display user-friendly error messages
	•	Validation Errors: Prevent invalid dimensions from being submitted
	•	Rate Limiting: Configurable delays between API calls
	•	Batch Processing: Continue processing even if individual dimensions fail

Limitations
	1.	GA4 Limits: Each property can have up to 50 custom dimensions
	2.	API Rate Limits: Google imposes rate limits on API calls
	3.	Permissions: Requires Admin/Editor access to GA4 properties
	4.	Browser Support: Modern browsers only (ES6+ required)
	5.	HTTPS Requirement: Production deployments must use HTTPS


API Issues
	•	“401 Unauthorized”: Token expired, re-authenticate
	•	“403 Quota exceeded”: Reduce batch size and increase delays
	•	“400 Bad Request”: Check dimension parameter validation



Security Considerations
	1.	Client-Side Application: All code runs in the browser
	2.	Token Storage: Access tokens stored in memory only (not persisted)
	3.	HTTPS Required: Protects OAuth flow and API communications
	4.	Scope Limitation: Requests minimal necessary permissions
	5.	No Server Storage: No user data is stored server-side

**Ensure compliance with Google’s Terms of Service when using their APIs.**
