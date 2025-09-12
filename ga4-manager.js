class GA4Manager {
  constructor() {
    this.accessToken = null;
    this.isAuthenticated = false;
    this.tokenClient = null;
    this.init();
    console.log('GA4Manager: Constructor initialized');
  }

  init() {
    console.log('GA4Manager: Starting initialization');
    
    gapi.load('client', () => {
      console.log('GA4Manager: GAPI client loaded');
      gapi.client.init({
        apiKey: '', 
        discoveryDocs: ['https://analyticsadmin.googleapis.com/$discovery/rest?version=v1beta']
      }).then(() => {
        console.log('GA4Manager: GAPI client initialized successfully');
      }).catch(error => {
        console.error('GA4Manager: GAPI client initialization failed:', error);
      });
    });

    google.accounts.id.initialize({
      client_id: '903553466558-ggf600mr9qauuimpfmc0olc94dledr2n.apps.googleusercontent.com'
    });
    console.log('GA4Manager: Google accounts ID initialized');

    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: '903553466558-ggf600mr9qauuimpfmc0olc94dledr2n.apps.googleusercontent.com',
      scope: 'https://www.googleapis.com/auth/analytics.edit',
      callback: (response) => {
        console.log('GA4Manager: OAuth callback received:', response);
        if (response.error !== undefined) {
          console.error('GA4Manager: OAuth error:', response.error);
          throw new Error(response.error);
        }
        this.handleAuthSuccess(response);
      },
    });
    console.log('GA4Manager: Token client initialized');
  }

  async authenticate() {
    console.log('GA4Manager: Starting authentication');
    try {
      this.tokenClient.requestAccessToken({prompt: 'consent'});
      console.log('GA4Manager: Access token requested');
    } catch (error) {
      console.error('GA4Manager: Authentication failed:', error);
      throw new Error('Authentication failed: ' + error.message);
    }
  }

  handleAuthSuccess(response) {
    console.log('GA4Manager: Authentication successful');
    this.isAuthenticated = true;
    this.accessToken = response.access_token;
    console.log('GA4Manager: Access token stored (length:', this.accessToken?.length, ')');
    
    // Update UI to show authenticated state
    const authBtn = document.getElementById('loadPropsBtn');
    if (authBtn && authBtn.textContent === 'Load My GA4 Properties') {
      authBtn.textContent = 'Authenticated - Click to Load Properties';
      authBtn.style.background = 'linear-gradient(135deg, #43a047 0%, #2e7d32 100%)';
      console.log('GA4Manager: UI updated to show authenticated state');
    }
  }

  async makeApiCall(url, options = {}) {
    console.log('GA4Manager: Making API call to:', url);
    console.log('GA4Manager: API call options:', options);
    
    if (!this.accessToken) {
      console.log('GA4Manager: No access token, triggering authentication');
      await this.authenticate();
      return;
    }

    const defaultOptions = {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    try {
      const finalOptions = { ...defaultOptions, ...options };
      console.log('GA4Manager: Final request options:', finalOptions);
      
      const response = await fetch(url, finalOptions);
      console.log('GA4Manager: API response status:', response.status, response.statusText);
      
      if (!response.ok) {
        if (response.status === 401) {
          console.warn('GA4Manager: Authentication expired, clearing token');
          this.accessToken = null;
          this.isAuthenticated = false;
          throw new Error('Authentication expired. Please try again.');
        }
        const errorText = await response.text();
        console.error('GA4Manager: API error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }
      
      const result = await response.json();
      console.log('GA4Manager: API call successful, response:', result);
      return result;
    } catch (error) {
      console.error('GA4Manager: API call failed:', error);
      throw error;
    }
  }
}

// Global variables with logging
let selectedPropertyIds = []; // Changed to array for multi-property support
let dimensions = [];
let metrics = [];
let existingDimensions = [];
let existingMetrics = [];
let currentTab = 'dimensions';

console.log('Global variables initialized');

async function createAllDimensions() {
  console.log('createAllDimensions: Starting creation process');
  console.log('createAllDimensions: Selected properties:', selectedPropertyIds);
  console.log('createAllDimensions: Current tab:', currentTab);
  console.log('createAllDimensions: Dimensions count:', dimensions.length);
  console.log('createAllDimensions: Metrics count:', metrics.length);

  if (selectedPropertyIds.length === 0) {
    console.error('createAllDimensions: No properties selected');
    throw new Error("Please select at least one property first");
  }

  if (currentTab === 'dimensions' && dimensions.length === 0) {
    console.error('createAllDimensions: No dimensions to create');
    throw new Error("Please add at least one dimension");
  }
  if (currentTab === 'metrics' && metrics.length === 0) {
    console.error('createAllDimensions: No metrics to create');
    throw new Error("Please add at least one metric");
  }

  const checkDuplicates = document.getElementById("checkDuplicates").checked;

  document.getElementById("processLoader").style.display = "block";

  try {
    const allResults = [];
    
    // Process each selected property
    for (const propertyId of selectedPropertyIds) {
      console.log(`createAllDimensions: Processing property ${propertyId}`);
      
      if (currentTab === 'dimensions') {
        const result = await createCustomDimensions(propertyId, dimensions, { checkDuplicates, batchSize, delay });
        allResults.push({ propertyId, type: 'dimensions', result });
      } else {
        const result = await createCustomMetrics(propertyId, metrics, { checkDuplicates, batchSize, delay });
        allResults.push({ propertyId, type: 'metrics', result });
      }
    }
    
    console.log('createAllDimensions: All results:', allResults);
    showMultiPropertyResults(allResults);
  } catch (err) {
    console.error('createAllDimensions: Error occurred:', err);
    showResults("❌ Error: " + err.message, true);
  } finally {
    document.getElementById("processLoader").style.display = "none";
    console.log('createAllDimensions: Process completed');
  }
}

async function createCustomDimensions(propertyId, dimensions, options = {}) {
  console.log('createCustomDimensions: Starting for property:', propertyId);
  console.log('createCustomDimensions: Dimensions to create:', dimensions);
  console.log('createCustomDimensions: Options:', options);

  if (!propertyId || !dimensions || dimensions.length === 0) {
    console.error('createCustomDimensions: Invalid input parameters');
    return { success: false, error: "Invalid input parameters." };
  }

  const results = [];
  const batchSize = options.batchSize || 10;
  const delay = options.delay || 1000;
  
  try {
    console.log('createCustomDimensions: Getting existing dimensions for duplicate check');
    const existingResult = await getExistingCustomDimensions(propertyId);
    const existingNames = existingResult.success ? 
      existingResult.dimensions.map(d => d.parameterName.toLowerCase()) : [];
    
    console.log('createCustomDimensions: Existing dimension names:', existingNames);

    for (let i = 0; i < dimensions.length; i += batchSize) {
      const batch = dimensions.slice(i, i + batchSize);
      console.log(`createCustomDimensions: Processing batch ${Math.floor(i/batchSize) + 1}, items:`, batch);
      
      for (let j = 0; j < batch.length; j++) {
        const dimension = batch[j];
        const actualIndex = i + j;
        
        console.log(`createCustomDimensions: Processing dimension ${actualIndex + 1}:`, dimension);
        
        try {
          if (!dimension.parameterName || !dimension.displayName) {
            console.error(`createCustomDimensions: Missing required fields for dimension ${actualIndex + 1}`);
            results.push({
              index: actualIndex,
              success: false,
              error: "Missing required fields (parameterName or displayName)",
              dimension: dimension
            });
            continue;
          }

          if (options.checkDuplicates && existingNames.includes(dimension.parameterName.toLowerCase())) {
            console.log(`createCustomDimensions: Duplicate found for dimension ${actualIndex + 1}`);
            results.push({
              index: actualIndex,
              success: false,
              error: "Custom dimension already exists",
              dimension: dimension,
              skipped: true
            });
            continue;
          }

          const payload = {
            parameterName: dimension.parameterName,
            displayName: dimension.displayName,
            scope: dimension.scope || "EVENT",
            description: dimension.description || "",
            disallowAdsPersonalization: dimension.disallowAdsPersonalization || false
          };

          console.log(`createCustomDimensions: API payload for dimension ${actualIndex + 1}:`, payload);

          const url = `https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}/customDimensions`;
          const response = await fetch(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${ga4Manager.accessToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
          });
          
          const responseText = await response.text();
          const responseCode = response.status;
          
          console.log(`createCustomDimensions: API response for dimension ${actualIndex + 1}:`, {
            status: responseCode,
            response: responseText
          });
          
          results.push({
            index: actualIndex,
            success: responseCode >= 200 && responseCode < 300,
            statusCode: responseCode,
            response: responseText,
            dimension: dimension,
            created: responseCode >= 200 && responseCode < 300 ? JSON.parse(responseText) : null
          });

        } catch (error) {
          console.error(`createCustomDimensions: Error creating dimension ${actualIndex + 1}:`, error);
          results.push({
            index: actualIndex,
            success: false,
            error: error.toString(),
            dimension: dimension
          });
        }
      }

      if (i + batchSize < dimensions.length) {
        console.log(`createCustomDimensions: Waiting ${delay}ms before next batch`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    const summary = {
      total: dimensions.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success && !r.skipped).length,
      skipped: results.filter(r => r.skipped).length
    };

    console.log('createCustomDimensions: Final summary:', summary);

    return { 
      success: true, 
      results: results,
      summary: summary
    };

  } catch (error) {
    console.error('createCustomDimensions: Unexpected error:', error);
    return { success: false, error: error.toString() };
  }
}

async function createCustomMetrics(propertyId, metrics, options = {}) {
  console.log('createCustomMetrics: Starting for property:', propertyId);
  console.log('createCustomMetrics: Metrics to create:', metrics);
  console.log('createCustomMetrics: Options:', options);

  if (!propertyId || !metrics || metrics.length === 0) {
    console.error('createCustomMetrics: Invalid input parameters');
    return { success: false, error: "Invalid input parameters." };
  }

  const results = [];
  const batchSize = options.batchSize || 10;
  const delay = options.delay || 1000;
  
  try {
    console.log('createCustomMetrics: Getting existing metrics for duplicate check');
    const existingResult = await getExistingCustomMetrics(propertyId);
    const existingNames = existingResult.success ? 
      existingResult.metrics.map(m => m.parameterName.toLowerCase()) : [];
    
    console.log('createCustomMetrics: Existing metric names:', existingNames);

    for (let i = 0; i < metrics.length; i += batchSize) {
      const batch = metrics.slice(i, i + batchSize);
      console.log(`createCustomMetrics: Processing batch ${Math.floor(i/batchSize) + 1}, items:`, batch);
      
      for (let j = 0; j < batch.length; j++) {
        const metric = batch[j];
        const actualIndex = i + j;
        
        console.log(`createCustomMetrics: Processing metric ${actualIndex + 1}:`, metric);
        
        try {
          if (!metric.parameterName || !metric.displayName) {
            console.error(`createCustomMetrics: Missing required fields for metric ${actualIndex + 1}`);
            results.push({
              index: actualIndex,
              success: false,
              error: "Missing required fields (parameterName or displayName)",
              metric: metric
            });
            continue;
          }

          if (options.checkDuplicates && existingNames.includes(metric.parameterName.toLowerCase())) {
            console.log(`createCustomMetrics: Duplicate found for metric ${actualIndex + 1}`);
            results.push({
              index: actualIndex,
              success: false,
              error: "Custom metric already exists",
              metric: metric,
              skipped: true
            });
            continue;
          }

          // Fixed payload structure for metrics
          const payload = {
            parameterName: metric.parameterName,
            displayName: metric.displayName,
            description: metric.description || "",
            measurementUnit: metric.measurementUnit || "STANDARD",
            scope: "EVENT" // Metrics are always EVENT scoped
          };

          console.log(`createCustomMetrics: API payload for metric ${actualIndex + 1}:`, payload);

          const url = `https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}/customMetrics`;
          const response = await fetch(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${ga4Manager.accessToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
          });
          
          const responseText = await response.text();
          const responseCode = response.status;
          
          console.log(`createCustomMetrics: API response for metric ${actualIndex + 1}:`, {
            status: responseCode,
            response: responseText
          });
          
          results.push({
            index: actualIndex,
            success: responseCode >= 200 && responseCode < 300,
            statusCode: responseCode,
            response: responseText,
            metric: metric,
            created: responseCode >= 200 && responseCode < 300 ? JSON.parse(responseText) : null
          });

        } catch (error) {
          console.error(`createCustomMetrics: Error creating metric ${actualIndex + 1}:`, error);
          results.push({
            index: actualIndex,
            success: false,
            error: error.toString(),
            metric: metric
          });
        }
      }

      if (i + batchSize < metrics.length) {
        console.log(`createCustomMetrics: Waiting ${delay}ms before next batch`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    const summary = {
      total: metrics.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success && !r.skipped).length,
      skipped: results.filter(r => r.skipped).length
    };

    console.log('createCustomMetrics: Final summary:', summary);

    return { 
      success: true, 
      results: results,
      summary: summary
    };

  } catch (error) {
    console.error('createCustomMetrics: Unexpected error:', error);
    return { success: false, error: error.toString() };
  }
}

function handleCreateResults(result, type) {
  console.log('handleCreateResults: Processing results:', result, 'Type:', type);
  
  document.getElementById('processLoader').style.display = 'none';
  document.getElementById('createBtn').disabled = false;

  if (result.success) {
    displayResults(result, type);
    // Refresh existing items for all selected properties
    if (selectedPropertyIds.length > 0) {
      if (type === 'dimensions') {
        loadExistingDimensions();
      } else {
        loadExistingMetrics();
      }
    }
  } else {
    showError(`Creation failed: ${result.error}`);
  }
}

function showMultiPropertyResults(allResults) {
  console.log('showMultiPropertyResults: Displaying results for multiple properties:', allResults);
  
  const resultsDiv = document.getElementById('results');
  let html = '<div class="results">';
  
  // Overall summary
  let totalSuccessful = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  let totalItems = 0;
  
  allResults.forEach(propResult => {
    if (propResult.result.success && propResult.result.summary) {
      totalSuccessful += propResult.result.summary.successful;
      totalFailed += propResult.result.summary.failed;
      totalSkipped += propResult.result.summary.skipped;
      totalItems += propResult.result.summary.total;
    }
  });
  
  html += '<div class="results-header">';
  html += `<h3>Multi-Property Results Summary</h3>`;
  html += `<p class="success">✓ Total successful: ${totalSuccessful}</p>`;
  if (totalFailed > 0) {
    html += `<p class="error">✗ Total failed: ${totalFailed}</p>`;
  }
  if (totalSkipped > 0) {
    html += `<p class="warning">⚠ Total skipped: ${totalSkipped}</p>`;
  }
  html += `<p>Processed across ${selectedPropertyIds.length} properties</p>`;
  html += '</div>';

  // Individual property results
  html += '<div class="results-body">';
  
  allResults.forEach(propResult => {
    const { propertyId, type, result } = propResult;
    const itemType = type === 'dimensions' ? 'dimension' : 'metric';
    
    html += `<div class="property-results">`;
    html += `<h4>Property: ${propertyId}</h4>`;
    
    if (result.success && result.results) {
      result.results.forEach(item => {
        const statusClass = item.success ? 'success' : (item.skipped ? 'warning' : 'error');
        const statusIcon = item.success ? '✓' : (item.skipped ? '⚠' : '✗');
        const itemData = item[itemType] || item.dimension || item.metric;
        
        html += '<div class="result-item">';
        html += `<div>`;
        html += `<span class="${statusClass}"><strong>${statusIcon}</strong></span> `;
        html += `<strong>${itemData.displayName}</strong> (${itemData.parameterName})`;
        if (item.error) {
          html += `<br><small class="error">${item.error}</small>`;
        } else if (item.skipped) {
          html += `<br><small class="warning">Already exists</small>`;
        }
        html += '</div>';
        html += `<span class="${statusClass}">Status: ${item.statusCode || 'N/A'}</span>`;
        html += '</div>';
      });
    } else {
      html += `<div class="result-item"><span class="error">Property failed: ${result.error}</span></div>`;
    }
    
    html += '</div>';
  });
  
  html += '</div>';
  html += '</div>';

  resultsDiv.innerHTML = html;
  resultsDiv.style.display = 'block';
}

function displayResults(result, type) {
  console.log('displayResults: Displaying single property results:', result, 'Type:', type);
  
  const resultsDiv = document.getElementById('results');
  const summary = result.summary;
  const itemType = type === 'dimensions' ? 'dimension' : 'metric';
  const itemTypePlural = type === 'dimensions' ? 'dimensions' : 'metrics';
  
  let html = '<div class="results">';
  html += '<div class="results-header">';
  html += `<h3>${itemTypePlural.charAt(0).toUpperCase() + itemTypePlural.slice(1)} Results Summary</h3>`;
  html += `<p class="success">✓ Successfully created: ${summary.successful}</p>`;
  if (summary.failed > 0) {
    html += `<p class="error">✗ Failed: ${summary.failed}</p>`;
  }
  if (summary.skipped > 0) {
    html += `<p class="warning">⚠ Skipped (duplicates): ${summary.skipped}</p>`;
  }
  html += `<p>Total processed: ${summary.total}</p>`;
  html += '</div>';

  html += '<div class="results-body">';
  result.results.forEach(item => {
    const statusClass = item.success ? 'success' : (item.skipped ? 'warning' : 'error');
    const statusIcon = item.success ? '✓' : (item.skipped ? '⚠' : '✗');
    const itemData = item[itemType] || item.dimension || item.metric;
    
    html += '<div class="result-item">';
    html += `<div>`;
    html += `<span class="${statusClass}"><strong>${statusIcon}</strong></span> `;
    html += `<strong>${itemData.displayName}</strong> (${itemData.parameterName})`;
    if (item.error) {
      html += `<br><small class="error">${item.error}</small>`;
    } else if (item.skipped) {
      html += `<br><small class="warning">Already exists</small>`;
    }
    html += '</div>';
    html += `<span class="${statusClass}">Status: ${item.statusCode || 'N/A'}</span>`;
    html += '</div>';
  });
  html += '</div>';
  html += '</div>';

  resultsDiv.innerHTML = html;
  resultsDiv.style.display = 'block';
}

function showError(message) {
  console.log('showError: Displaying error:', message);
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = `<div class="results"><div class="results-header"><p class="error"><strong>Error:</strong> ${message}</p></div></div>`;
  resultsDiv.style.display = 'block';
}

function showSuccess(message) {
  console.log('showSuccess: Displaying success message:', message);
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = `<div class="results"><div class="results-header"><p class="success">${message}</p></div></div>`;
  resultsDiv.style.display = 'block';
  setTimeout(() => {
    resultsDiv.style.display = 'none';
  }, 3000);
}

function handleError(error) {
  console.error('handleError: Processing error:', error);
  document.getElementById('processLoader').style.display = 'none';
  document.getElementById('propertyLoader').style.display = 'none';
  document.getElementById('createBtn').disabled = false;
  document.getElementById('loadPropsBtn').disabled = false;
  showError(error.toString());
}

const ga4Manager = new GA4Manager();

function switchTab(tabName) {
  console.log('switchTab: Switching to tab:', tabName);
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  event.target.classList.add('active');
  document.getElementById(tabName + '-tab').classList.add('active');
  
  currentTab = tabName;
  updateCreateButton();
}

async function loadProperties() {
  console.log('loadProperties: Starting to load properties');
  
  if (!ga4Manager.isAuthenticated) {
    console.log('loadProperties: Not authenticated, triggering authentication');
    await ga4Manager.authenticate();
    return;
  }

  document.getElementById('propertyLoader').style.display = 'block';
  document.getElementById('loadPropsBtn').disabled = true;
  
  try {
    console.log('loadProperties: Fetching properties list');
    const result = await getPropertiesList();
    handlePropertiesLoaded(result);
  } catch (error) {
    console.error('loadProperties: Error loading properties:', error);
    handleError(error);
  }
}

async function getPropertiesList() {
  console.log('getPropertiesList: Fetching accounts and properties');
  
  try {
    const accountsUrl = "https://analyticsadmin.googleapis.com/v1beta/accounts";
    const accountsData = await ga4Manager.makeApiCall(accountsUrl);
    const accounts = accountsData.accounts || [];
    console.log('getPropertiesList: Found accounts:', accounts.length);

    const allProps = [];

    for (const account of accounts) {
      const accountId = account.name.split("/")[1];
      const accountName = account.displayName;
      console.log(`getPropertiesList: Processing account ${accountName} (${accountId})`);
      
      const propsUrl = `https://analyticsadmin.googleapis.com/v1beta/properties?filter=parent:accounts/${accountId}`;
      const propsData = await ga4Manager.makeApiCall(propsUrl);
      const properties = propsData.properties || [];
      console.log(`getPropertiesList: Found ${properties.length} properties for account ${accountName}`);

      properties.forEach(prop => {
        allProps.push({ 
          name: prop.displayName, 
          id: prop.name.split("/")[1],
          accountName: accountName,
          accountId: accountId,
          propertyType: prop.propertyType || 'PROPERTY_TYPE_ORDINARY'
        });
      });
    }

    console.log('getPropertiesList: Total properties found:', allProps.length);
    return { success: true, properties: allProps };
  } catch (error) {
    console.error('getPropertiesList: Error:', error);
    return { success: false, error: error.toString() };
  }
}

function handlePropertiesLoaded(result) {
  console.log('handlePropertiesLoaded: Processing loaded properties:', result);
  
  document.getElementById('propertyLoader').style.display = 'none';
  document.getElementById('loadPropsBtn').disabled = false;
  
  if (result.success) {
    const select = document.getElementById('propertySelect');
    select.innerHTML = '';
    
    // Add "Select All" option
    const selectAllOption = document.createElement('option');
    selectAllOption.value = 'SELECT_ALL';
    selectAllOption.textContent = 'Select All Properties';
    select.appendChild(selectAllOption);
    
    const accountGroups = {};
    result.properties.forEach(prop => {
      if (!accountGroups[prop.accountName]) {
        accountGroups[prop.accountName] = [];
      }
      accountGroups[prop.accountName].push(prop);
    });

    Object.keys(accountGroups).forEach(accountName => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = accountName;
      
      accountGroups[accountName].forEach(prop => {
        const option = document.createElement('option');
        option.value = prop.id;
        option.textContent = `${prop.name} (${prop.id})`;
        optgroup.appendChild(option);
      });
      
      select.appendChild(optgroup);
    });
    
    // Convert to multi-select
    select.multiple = true;
    select.size = Math.min(10, result.properties.length + 1);
    select.style.display = 'block';
    
    console.log('handlePropertiesLoaded: Property select updated with multi-select support');
  } else {
    showError('Failed to load properties: ' + result.error);
  }
}

function onPropertyChange() {
  const select = document.getElementById('propertySelect');
  const selectedOptions = Array.from(select.selectedOptions);
  console.log('onPropertyChange: Selected options:', selectedOptions);
  
  // Handle "Select All" option
  if (selectedOptions.some(option => option.value === 'SELECT_ALL')) {
    console.log('onPropertyChange: Select All chosen');
    // Select all property options except "Select All"
    Array.from(select.options).forEach(option => {
      if (option.value !== 'SELECT_ALL') {
        option.selected = true;
      } else {
        option.selected = false;
      }
    });
    selectedPropertyIds = Array.from(select.options)
      .filter(option => option.selected && option.value !== 'SELECT_ALL')
      .map(option => option.value);
  } else {
    selectedPropertyIds = selectedOptions
      .filter(option => option.value !== 'SELECT_ALL')
      .map(option => option.value);
  }
  
  // Limit to 3 properties maximum
  if (selectedPropertyIds.length > 3) {
    console.log('onPropertyChange: Too many properties selected, limiting to first 3');
    selectedPropertyIds = selectedPropertyIds.slice(0, 3);
    // Update UI to reflect the limitation
    Array.from(select.options).forEach((option, index) => {
      if (option.value !== 'SELECT_ALL' && selectedPropertyIds.includes(option.value)) {
        option.selected = true;
      } else if (option.value !== 'SELECT_ALL') {
        option.selected = false;
      }
    });
    showError('Maximum 3 properties can be selected at once.');
  }
  
  console.log('onPropertyChange: Final selected property IDs:', selectedPropertyIds);
  
  if (selectedPropertyIds.length > 0) {
    loadExistingDimensions();
    loadExistingMetrics();
    updateCreateButton();
    updatePropertyDisplay();
  }
}

function updatePropertyDisplay() {
  console.log('updatePropertyDisplay: Updating display for selected properties');
  const displayDiv = document.getElementById('selectedPropertiesDisplay');
  if (selectedPropertyIds.length > 0) {
    displayDiv.innerHTML = `<p><strong>Selected Properties (${selectedPropertyIds.length}/3):</strong> ${selectedPropertyIds.join(', ')}</p>`;
    displayDiv.style.display = 'block';
  } else {
    displayDiv.style.display = 'none';
  }
}

async function loadExistingDimensions() {
  console.log('loadExistingDimensions: Loading existing dimensions for selected properties');
  
  try {
    const allDimensions = [];
    
    for (const propertyId of selectedPropertyIds) {
      console.log(`loadExistingDimensions: Loading for property ${propertyId}`);
      const result = await getExistingCustomDimensions(propertyId);
      if (result.success) {
        allDimensions.push({
          propertyId,
          dimensions: result.dimensions
        });
      }
    }
    
    existingDimensions = allDimensions;
    displayExistingDimensions();
  } catch (error) {
    console.error('loadExistingDimensions: Error:', error);
    handleError(error);
  }
}

async function loadExistingMetrics() {
  console.log('loadExistingMetrics: Loading existing metrics for selected properties');
  
  try {
    const allMetrics = [];
    
    for (const propertyId of selectedPropertyIds) {
      console.log(`loadExistingMetrics: Loading for property ${propertyId}`);
      const result = await getExistingCustomMetrics(propertyId);
      if (result.success) {
        allMetrics.push({
          propertyId,
          metrics: result.metrics
        });
      }
    }
    
    existingMetrics = allMetrics;
    displayExistingMetrics();
  } catch (error) {
    console.error('loadExistingMetrics: Error:', error);
    handleError(error);
  }
}

async function getExistingCustomDimensions(propertyId) {
  console.log('getExistingCustomDimensions: Fetching for property:', propertyId);
  
  try {
    const url = `https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}/customDimensions`;
    const data = await ga4Manager.makeApiCall(url);
    
    const dimensions = (data.customDimensions || []).map(dim => ({
      name: dim.name,
      displayName: dim.displayName,
      parameterName: dim.parameterName,
      scope: dim.scope,
      description: dim.description || '',
      disallowAdsPersonalization: dim.disallowAdsPersonalization || false
    }));

    console.log(`getExistingCustomDimensions: Found ${dimensions.length} dimensions for property ${propertyId}`);
    return { success: true, dimensions: dimensions };
  } catch (error) {
    console.error('getExistingCustomDimensions: Error:', error);
    return { success: false, error: error.toString() };
  }
}

async function getExistingCustomMetrics(propertyId) {
  console.log('getExistingCustomMetrics: Fetching for property:', propertyId);
  
  try {
    const url = `https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}/customMetrics`;
    const data = await ga4Manager.makeApiCall(url);
    
    const metrics = (data.customMetrics || []).map(metric => ({
      name: metric.name,
      displayName: metric.displayName,
      parameterName: metric.parameterName,
      scope: metric.scope,
      description: metric.description || '',
      measurementUnit: metric.measurementUnit || 'STANDARD'
    }));

    console.log(`getExistingCustomMetrics: Found ${metrics.length} metrics for property ${propertyId}`);
    return { success: true, metrics: metrics };
  } catch (error) {
    console.error('getExistingCustomMetrics: Error:', error);
    return { success: false, error: error.toString() };
  }
}

function displayExistingDimensions() {
  console.log('displayExistingDimensions: Displaying existing dimensions');
  
  const container = document.getElementById('existingDimensions');
  if (existingDimensions.length > 0) {
    let html = '<div class="existing-dimensions">';
    html += '<h4>Existing Custom Dimensions</h4>';
    
    existingDimensions.forEach(propData => {
      if (propData.dimensions.length > 0) {
        html += `<div class="property-existing">`;
        html += `<h5>Property ${propData.propertyId} (${propData.dimensions.length} dimensions)</h5>`;
        html += '<div style="max-height: 100px; overflow-y: auto; font-size: 13px;">';
        propData.dimensions.forEach(dim => {
          html += `<div>${dim.displayName} (${dim.parameterName}) - ${dim.scope}</div>`;
        });
        html += '</div></div>';
      }
    });
    
    html += '</div>';
    container.innerHTML = html;
    container.style.display = 'block';
  } else {
    container.style.display = 'none';
  }
}

function displayExistingMetrics() {
  console.log('displayExistingMetrics: Displaying existing metrics');
  
  const container = document.getElementById('existingMetrics');
  if (existingMetrics.length > 0) {
    let html = '<div class="existing-metrics">';
    html += '<h4>Existing Custom Metrics</h4>';
    
    existingMetrics.forEach(propData => {
      if (propData.metrics.length > 0) {
        html += `<div class="property-existing">`;
        html += `<h5>Property ${propData.propertyId} (${propData.metrics.length} metrics)</h5>`;
        html += '<div style="max-height: 100px; overflow-y: auto; font-size: 13px;">';
        propData.metrics.forEach(metric => {
          html += `<div>${metric.displayName} (${metric.parameterName}) - ${metric.measurementUnit}</div>`;
        });
        html += '</div></div>';
      }
    });
    
    html += '</div>';
    container.innerHTML = html;
    container.style.display = 'block';
  } else {
    container.style.display = 'none';
  }
}

// Dimension functions
function addManualDimension() {
  console.log('addManualDimension: Adding manual dimension');
  
  const displayName = document.getElementById('manualDisplayName').value.trim();
  const parameterName = document.getElementById('manualParameterName').value.trim();
  const description = document.getElementById('manualDescription').value.trim();
  const scope = document.getElementById('manualScope').value;

  console.log('addManualDimension: Input values:', { displayName, parameterName, description, scope });

  if (!displayName || !parameterName) {
    console.error('addManualDimension: Missing required fields');
    showError('Display Name and Parameter Name are required');
    return;
  }

  const dimension = {
    displayName,
    parameterName,
    description,
    scope,
    source: 'manual'
  };

  dimensions.push(dimension);
  console.log('addManualDimension: Dimension added, total count:', dimensions.length);
  
  document.getElementById('manualDisplayName').value = '';
  document.getElementById('manualParameterName').value = '';
  document.getElementById('manualDescription').value = '';
  document.getElementById('manualScope').value = 'EVENT';

  updateDimensionList();
  updateCreateButton();
}

// Metric functions
function addManualMetric() {
  console.log('addManualMetric: Adding manual metric');
  
  const displayName = document.getElementById('metricManualDisplayName').value.trim();
  const parameterName = document.getElementById('metricManualParameterName').value.trim();
  const description = document.getElementById('metricManualDescription').value.trim();
  const measurementUnit = document.getElementById('metricManualUnit').value;

  console.log('addManualMetric: Input values:', { displayName, parameterName, description, measurementUnit });

  if (!displayName || !parameterName) {
    console.error('addManualMetric: Missing required fields');
    showError('Display Name and Parameter Name are required');
    return;
  }

  const metric = {
    displayName,
    parameterName,
    description,
    measurementUnit,
    scope: 'EVENT', // Metrics are always EVENT scoped
    source: 'manual'
  };

  metrics.push(metric);
  console.log('addManualMetric: Metric added, total count:', metrics.length);
  
  document.getElementById('metricManualDisplayName').value = '';
  document.getElementById('metricManualParameterName').value = '';
  document.getElementById('metricManualDescription').value = '';
  document.getElementById('metricManualUnit').value = 'STANDARD';

  updateMetricList();
  updateCreateButton();
}

function generateSample() {
  console.log('generateSample: Generating sample data for tab:', currentTab);
  
  if (currentTab === 'dimensions') {
    const sampleDimensions = [
      {
        displayName: "User Type",
        parameterName: "user_type",
        description: "Identifies if user is new or returning",
        scope: "USER",
        source: 'sample'
      },
      {
        displayName: "Page Category",
        parameterName: "page_category",
        description: "Category of the page being viewed",
        scope: "EVENT",
        source: 'sample'
      },
      {
        displayName: "Product Brand",
        parameterName: "product_brand",
        description: "Brand of the product",
        scope: "ITEM",
        source: 'sample'
      }
    ];

    dimensions = dimensions.concat(sampleDimensions);
    updateDimensionList();
    showSuccess('Added 3 sample dimensions');
  } else {
    const sampleMetrics = [
      {
        displayName: "Page Load Time",
        parameterName: "page_load_time",
        description: "Time taken to load the page",
        measurementUnit: "MILLISECONDS",
        scope: "EVENT",
        source: 'sample'
      },
      {
        displayName: "Video Watch Duration",
        parameterName: "video_watch_duration",
        description: "Duration of video watched",
        measurementUnit: "SECONDS",
        scope: "EVENT",
        source: 'sample'
      }
    ];

    metrics = metrics.concat(sampleMetrics);
    updateMetricList();
    showSuccess('Added 3 sample metrics');
  }
  
  updateCreateButton();
}

function handleDragOver(event) {
  console.log('handleDragOver: File drag detected');
  event.preventDefault();
  event.currentTarget.classList.add('dragover');
}

function handleFileDrop(event) {
  console.log('handleFileDrop: File drop detected');
  event.preventDefault();
  event.currentTarget.classList.remove('dragover');
  
  const files = event.dataTransfer.files;
  if (files.length > 0) {
    console.log('handleFileDrop: Processing dropped file:', files[0].name);
    handleFile(files[0], 'csv');
  }
}

function handleFileSelect(event, format) {
  console.log('handleFileSelect: File selected:', event.target.files[0]?.name, 'Format:', format);
  const file = event.target.files[0];
  if (file) {
    handleFile(file, format);
  }
}

function handleFile(file, format) {
  console.log('handleFile: Processing file:', file.name, 'Size:', file.size, 'Type:', file.type);
  
  const reader = new FileReader();
  reader.onload = function(e) {
    console.log('handleFile: File read complete, content length:', e.target.result.length);
    const content = e.target.result;
    
    if (format === 'csv') {
      const csvData = parseCSV(content);
      console.log('handleFile: CSV parsed, rows:', csvData.length);
      processInputData(csvData, 'csv');
    }
  };
  reader.readAsText(file);
}

function parseCSV(csv) {
  console.log('parseCSV: Parsing CSV content');
  const lines = csv.split('\n');
  const result = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line) {
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      result.push(values);
    }
  }
  
  console.log('parseCSV: CSV parsing complete, rows:', result.length);
  return result;
}

function processInputData(data, format) {
  console.log('processInputData: Processing input data, format:', format, 'rows:', data.length);
  
  try {
    const result = parseInput(data, format);
    console.log('processInputData: Parse result:', result);
    
    if (result.success) {
      if (result.dimensions && result.dimensions.length > 0) {
        dimensions = dimensions.concat(result.dimensions.map(d => ({...d, source: format})));
        updateDimensionList();
        showSuccess(`Added ${result.dimensions.length} dimensions from ${format.toUpperCase()}`);
      }
      if (result.metrics && result.metrics.length > 0) {
        metrics = metrics.concat(result.metrics.map(m => ({...m, source: format})));
        updateMetricList();
        showSuccess(`Added ${result.metrics.length} metrics from ${format.toUpperCase()}`);
      }
      updateCreateButton();
    } else {
      showError('Parse error: ' + result.error);
    }
  } catch (error) {
    console.error('processInputData: Error processing data:', error);
    handleError(error);
  }
}

function parseInput(inputData, format) {
  console.log('parseInput: Parsing input data, format:', format);
  
  try {
    switch (format) {
      case 'csv':
        return parseCSVData(inputData);
      case 'manual':
        return { success: true, [currentTab]: inputData };
      default:
        return { success: false, error: "Unsupported format" };
    }
  } catch (error) {
    console.error('parseInput: Error:', error);
    return { success: false, error: error.toString() };
  }
}

// Updated CSV parsing function to handle unified format
function parseCSVData(csvData) {
  console.log('parseCSVData: Parsing unified CSV format');
  
  if (!csvData || csvData.length < 2) {
    return { success: false, error: "CSV must have header row and at least one data row" };
  }

  const headers = csvData[0].map(h => h.toLowerCase().trim());
  console.log('parseCSVData: Headers found:', headers);
  
  const dimensions = [];
  const metrics = [];

  const headerMap = {
    parameterName: findHeader(headers, ['key', 'parameter name', 'parametername']),
    displayName: findHeader(headers, ['name', 'display name', 'displayname']),
    description: findHeader(headers, ['notes/description', 'description', 'notes', 'desc']),
    createDimension: findHeader(headers, ['ga4 custom dimension', 'custom dimension', 'dimension']),
    createMetric: findHeader(headers, ['ga4 custom metric', 'custom metric', 'metric']),
    measurementUnit: findHeader(headers, ['measurement unit', 'measurementunit', 'unit'])
  };

  console.log('parseCSVData: Header mapping:', headerMap);

  for (let i = 1; i < csvData.length; i++) {
    const row = csvData[i];
    console.log(`parseCSVData: Processing row ${i}:`, row);
    
    // Check if this row should create a dimension
    const shouldCreateDimension = headerMap.createDimension !== -1 ? 
      String(row[headerMap.createDimension] || '').toLowerCase().includes('true') : false;
    
    // Check if this row should create a metric
    const shouldCreateMetric = headerMap.createMetric !== -1 ? 
      String(row[headerMap.createMetric] || '').toLowerCase().includes('true') : false;

    if (headerMap.displayName !== -1 && headerMap.parameterName !== -1) {
      const baseItem = {
        displayName: row[headerMap.displayName] || '',
        parameterName: row[headerMap.parameterName] || '',
        description: headerMap.description !== -1 ? (row[headerMap.description] || '') : ''
      };

      // Create dimension if requested
      if (shouldCreateDimension) {
        const scope = "EVENT"; 
        
        dimensions.push({
          ...baseItem,
          scope: scope,
          disallowAdsPersonalization: false
        });
        console.log(`parseCSVData: Added dimension from row ${i}`);
      }

      // Create metric if requested  
      if (shouldCreateMetric) {
        metrics.push({
          ...baseItem,
          measurementUnit: (headerMap.measurementUnit !== -1 && row[headerMap.measurementUnit]) ? row[headerMap.measurementUnit] : 'STANDARD',
          scope: 'EVENT'
        });
        console.log(`parseCSVData: Added metric from row ${i}`);
      }
    }
  }

  console.log(`parseCSVData: Parsing complete - ${dimensions.length} dimensions, ${metrics.length} metrics`);
  return { 
    success: true, 
    dimensions: dimensions,
    metrics: metrics
  };
}

function findHeader(headers, searchTerms) {
  for (let term of searchTerms) {
    const index = headers.findIndex(h => h.includes(term));
    if (index !== -1) {
      console.log(`findHeader: Found header "${term}" at index ${index}`);
      return index;
    }
  }
  console.log(`findHeader: No header found for terms:`, searchTerms);
  return -1;
}

function downloadTemplate(format) {
  console.log('downloadTemplate: Generating template for format:', format);
  const template = generateSampleTemplate(format);
  const blob = new Blob([template], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ga4-unified-template.${format}`;
  a.click();
  URL.revokeObjectURL(url);
  console.log('downloadTemplate: Template downloaded');
}

function generateSampleTemplate(format) {
  console.log('generateSampleTemplate: Creating unified template');
  
  const sampleData = [
    {
      parameterName: "user_type",
      displayName: "User Type", 
      description: "Identifies if user is new or returning",
      pageLevel: "FALSE", // USER scope
      customDimension: "TRUE",
      customMetric: "FALSE"
    },
    {
      parameterName: "page_category",
      displayName: "Page Category",
      description: "Category of the page being viewed", 
      pageLevel: "TRUE", // EVENT scope
      customDimension: "TRUE",
      customMetric: "FALSE"
    },
    {
      parameterName: "page_load_time",
      displayName: "Page Load Time",
      description: "Time taken to load the page",
      pageLevel: "TRUE", // EVENT scope for metric
      customDimension: "FALSE",
      customMetric: "TRUE"
    }
  ];
  
  switch (format) {
    case 'csv':
      let csv = "Key,Name,Notes/Description,GA4 Custom Dimension,GA4 Custom Metric,Measurement Unit\n";
      sampleData.forEach(item => {
        csv += `"${item.parameterName}","${item.displayName}","${item.description}","${item.customDimension}","${item.customMetric}","${item.measurementUnit}"\n`;
      });
      return csv;
    
    default:
      return JSON.stringify(sampleData, null, 2);
  }
}

function updateDimensionList() {
  console.log('updateDimensionList: Updating dimension list, count:', dimensions.length);
  
  const container = document.getElementById('dimensionList');
  const count = document.getElementById('dimensionCount');
  count.textContent = dimensions.length;

  if (dimensions.length === 0) {
    container.innerHTML = '<p>No dimensions added yet. Use the input methods above to add some.</p>';
    return;
  }

  let html = '';
  dimensions.forEach((dim, index) => {
    html += `
      <div class="dimension-item">
        <div>
          <strong>${dim.displayName}</strong> (${dim.parameterName})
          <br><small>${dim.description || 'No description'} - Scope: ${dim.scope}</small>
          <br><small style="color: #666;">Source: ${dim.source}</small>
        </div>
        <button onclick="removeDimension(${index})" class="btn-secondary btn-small">Remove</button>
      </div>
    `;
  });

  container.innerHTML = html;
}

function updateMetricList() {
  console.log('updateMetricList: Updating metric list, count:', metrics.length);
  
  const container = document.getElementById('metricList');
  const count = document.getElementById('metricCount');
  count.textContent = metrics.length;

  if (metrics.length === 0) {
    container.innerHTML = '<p>No metrics added yet. Use the input methods above to add some.</p>';
    return;
  }

  let html = '';
  metrics.forEach((metric, index) => {
    html += `
      <div class="metric-item">
        <div>
          <strong>${metric.displayName}</strong> (${metric.parameterName})
          <br><small>${metric.description || 'No description'} - Unit: ${metric.measurementUnit}</small>
          <br><small style="color: #666;">Source: ${metric.source}</small>
        </div>
        <button onclick="removeMetric(${index})" class="btn-secondary btn-small">Remove</button>
      </div>
    `;
  });

  container.innerHTML = html;
}

function removeDimension(index) {
  console.log('removeDimension: Removing dimension at index:', index);
  dimensions.splice(index, 1);
  updateDimensionList();
  updateCreateButton();
}

function removeMetric(index) {
  console.log('removeMetric: Removing metric at index:', index);
  metrics.splice(index, 1);
  updateMetricList();
  updateCreateButton();
}

function clearAllDimensions() {
  console.log('clearAllDimensions: Clearing all dimensions');
  if (confirm('Are you sure you want to clear all dimensions?')) {
    dimensions = [];
    updateDimensionList();
    updateCreateButton();
  }
}

function clearAllMetrics() {
  console.log('clearAllMetrics: Clearing all metrics');
  if (confirm('Are you sure you want to clear all metrics?')) {
    metrics = [];
    updateMetricList();
    updateCreateButton();
  }
}

function validateAllDimensions() {
  console.log('validateAllDimensions: Validating all dimensions');
  const result = validateDimensions(dimensions);
  let message = '';
  if (result.errors.length > 0) {
    message += 'Errors:\n' + result.errors.join('\n') + '\n\n';
  }
  if (result.warnings.length > 0) {
    message += 'Warnings:\n' + result.warnings.join('\n');
  }
  if (message) {
    alert(message);
  } else {
    showSuccess('All dimensions are valid!');
  }
}

function validateAllMetrics() {
  console.log('validateAllMetrics: Validating all metrics');
  const result = validateMetrics(metrics);
  let message = '';
  if (result.errors.length > 0) {
    message += 'Errors:\n' + result.errors.join('\n') + '\n\n';
  }
  if (result.warnings.length > 0) {
    message += 'Warnings:\n' + result.warnings.join('\n');
  }
  if (message) {
    alert(message);
  } else {
    showSuccess('All metrics are valid!');
  }
}

function validateDimensions(dimensions) {
  console.log('validateDimensions: Validating dimensions array');
  const errors = [];
  const warnings = [];
  
  dimensions.forEach((dim, index) => {
    if (!dim.displayName) {
      errors.push(`Row ${index + 1}: Display name is required`);
    }
    if (!dim.parameterName) {
      errors.push(`Row ${index + 1}: Parameter name is required`);
    }
    
    if (dim.parameterName && !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(dim.parameterName)) {
      errors.push(`Row ${index + 1}: Parameter name must start with letter and contain only letters, numbers, and underscores`);
    }
    
    if (dim.displayName && dim.displayName.length > 82) {
      warnings.push(`Row ${index + 1}: Display name is longer than 82 characters`);
    }
    if (dim.description && dim.description.length > 150) {
      warnings.push(`Row ${index + 1}: Description is longer than 150 characters`);
    }
    
    if (dim.scope && !['EVENT', 'USER', 'ITEM'].includes(dim.scope)) {
      warnings.push(`Row ${index + 1}: Invalid scope. Using EVENT as default`);
      dim.scope = 'EVENT';
    }
  });
  
  console.log('validateDimensions: Validation complete, errors:', errors.length, 'warnings:', warnings.length);
  return { errors, warnings };
}

function validateMetrics(metrics) {
  console.log('validateMetrics: Validating metrics array');
  const errors = [];
  const warnings = [];
  const validUnits = ['STANDARD', 'CURRENCY', 'FEET', 'METERS', 'KILOMETERS', 'MILES', 'MILLISECONDS', 'SECONDS', 'MINUTES', 'HOURS'];
  
  metrics.forEach((metric, index) => {
    if (!metric.displayName) {
      errors.push(`Row ${index + 1}: Display name is required`);
    }
    if (!metric.parameterName) {
      errors.push(`Row ${index + 1}: Parameter name is required`);
    }
    
    if (metric.parameterName && !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(metric.parameterName)) {
      errors.push(`Row ${index + 1}: Parameter name must start with letter and contain only letters, numbers, and underscores`);
    }
    
    if (metric.displayName && metric.displayName.length > 82) {
      warnings.push(`Row ${index + 1}: Display name is longer than 82 characters`);
    }
    if (metric.description && metric.description.length > 150) {
      warnings.push(`Row ${index + 1}: Description is longer than 150 characters`);
    }
    
    if (metric.measurementUnit && !validUnits.includes(metric.measurementUnit)) {
      warnings.push(`Row ${index + 1}: Invalid measurement unit. Using STANDARD as default`);
      metric.measurementUnit = 'STANDARD';
    }
  });
  
  console.log('validateMetrics: Validation complete, errors:', errors.length, 'warnings:', warnings.length);
  return { errors, warnings };
}

function updateCreateButton() {
  console.log('updateCreateButton: Updating create button state');
  
  const createBtn = document.getElementById('createBtn');
  const sectionTitle = document.getElementById('createSectionTitle');
  const processText = document.getElementById('processText');

  const itemsCount = currentTab === 'dimensions' ? dimensions.length : metrics.length;
  createBtn.disabled = selectedPropertyIds.length === 0 || itemsCount === 0;

  if (currentTab === 'dimensions') {
    createBtn.textContent = `Create ${itemsCount} Custom Dimensions in ${selectedPropertyIds.length} Properties`;
    sectionTitle.textContent = "Create Custom Dimensions";
    processText.textContent = "Creating custom dimensions...";
  } else {
    createBtn.textContent = `Create ${itemsCount} Custom Metrics in ${selectedPropertyIds.length} Properties`;
    sectionTitle.textContent = "Create Custom Metrics";
    processText.textContent = "Creating custom metrics...";
  }
  
  console.log('updateCreateButton: Button state updated -', {
    disabled: createBtn.disabled,
    text: createBtn.textContent,
    properties: selectedPropertyIds.length,
    items: itemsCount
  });
}