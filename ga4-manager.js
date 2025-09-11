class GA4Manager {
  constructor() {
    this.accessToken = null;
    this.isAuthenticated = false;
    this.tokenClient = null;
    this.init();
  }

  init() {
    gapi.load('client', () => {
      gapi.client.init({
        apiKey: '', 
        discoveryDocs: ['https://analyticsadmin.googleapis.com/$discovery/rest?version=v1beta']
      });
    });

    google.accounts.id.initialize({
      client_id: '903553466558-ggf600mr9qauuimpfmc0olc94dledr2n.apps.googleusercontent.com'
    });

    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: '903553466558-ggf600mr9qauuimpfmc0olc94dledr2n.apps.googleusercontent.com',
      scope: 'https://www.googleapis.com/auth/analytics.edit',
      callback: (response) => {
        if (response.error !== undefined) {
          throw new Error(response.error);
        }
        this.handleAuthSuccess(response);
      },
    });
  }

  async authenticate() {
    try {
      this.tokenClient.requestAccessToken({prompt: 'consent'});
    } catch (error) {
      console.error('Authentication failed:', error);
      throw new Error('Authentication failed: ' + error.message);
    }
  }

  handleAuthSuccess(response) {
    this.isAuthenticated = true;
    this.accessToken = response.access_token;
    
    // Update UI to show authenticated state
    const authBtn = document.getElementById('loadPropsBtn');
    if (authBtn && authBtn.textContent === 'Load My GA4 Properties') {
      authBtn.textContent = 'Authenticated - Click to Load Properties';
      authBtn.style.background = 'linear-gradient(135deg, #43a047 0%, #2e7d32 100%)';
    }
  }

  async makeApiCall(url, options = {}) {
    if (!this.accessToken) {
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
      const response = await fetch(url, { ...defaultOptions, ...options });
      
      if (!response.ok) {
        if (response.status === 401) {
          this.accessToken = null;
          this.isAuthenticated = false;
          throw new Error('Authentication expired. Please try again.');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('API call failed:', error);
      throw error;
    }
  }
}

async function createAllDimensions() {
  if (!selectedPropertyId || dimensions.length === 0) {
    showError('Please select a property and add dimensions');
    return;
  }

  const options = {
    checkDuplicates: document.getElementById('checkDuplicates').checked,
    batchSize: parseInt(document.getElementById('batchSize').value),
    delay: parseInt(document.getElementById('delay').value)
  };

  document.getElementById('processLoader').style.display = 'block';
  document.getElementById('createBtn').disabled = true;

  try {
    if (currentTab === 'dimensions') {
      const result = await createCustomDimensions(selectedPropertyId, dimensions, options);
      handleCreateResults(result, 'dimensions');
    } else {
      const result = await createCustomMetrics(selectedPropertyId, metrics, options);
      handleCreateResults(result, 'metrics');
    }
  } catch (error) {
    handleError(error);
  }
}

async function createCustomDimensions(propertyId, dimensions, options = {}) {
  if (!propertyId || !dimensions || dimensions.length === 0) {
    return { success: false, error: "Invalid input parameters." };
  }

  const results = [];
  const batchSize = options.batchSize || 10;
  const delay = options.delay || 1000;
  
  try {
    const existingResult = await getExistingCustomDimensions(propertyId);
    const existingNames = existingResult.success ? 
      existingResult.dimensions.map(d => d.parameterName.toLowerCase()) : [];

    for (let i = 0; i < dimensions.length; i += batchSize) {
      const batch = dimensions.slice(i, i + batchSize);
      
      for (let j = 0; j < batch.length; j++) {
        const dimension = batch[j];
        const actualIndex = i + j;
        
        try {
          if (!dimension.parameterName || !dimension.displayName) {
            results.push({
              index: actualIndex,
              success: false,
              error: "Missing required fields (parameterName or displayName)",
              dimension: dimension
            });
            continue;
          }

          if (options.checkDuplicates && existingNames.includes(dimension.parameterName.toLowerCase())) {
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
          
          results.push({
            index: actualIndex,
            success: responseCode >= 200 && responseCode < 300,
            statusCode: responseCode,
            response: responseText,
            dimension: dimension,
            created: responseCode >= 200 && responseCode < 300 ? JSON.parse(responseText) : null
          });

        } catch (error) {
          results.push({
            index: actualIndex,
            success: false,
            error: error.toString(),
            dimension: dimension
          });
        }
      }

      if (i + batchSize < dimensions.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    const summary = {
      total: dimensions.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success && !r.skipped).length,
      skipped: results.filter(r => r.skipped).length
    };

    return { 
      success: true, 
      results: results,
      summary: summary
    };

  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

async function createCustomMetrics(propertyId, metrics, options = {}) {
  if (!propertyId || !metrics || metrics.length === 0) {
    return { success: false, error: "Invalid input parameters." };
  }

  const results = [];
  const batchSize = options.batchSize || 10;
  const delay = options.delay || 1000;
  
  try {
    const existingResult = await getExistingCustomMetrics(propertyId);
    const existingNames = existingResult.success ? 
      existingResult.metrics.map(m => m.parameterName.toLowerCase()) : [];

    for (let i = 0; i < metrics.length; i += batchSize) {
      const batch = metrics.slice(i, i + batchSize);
      
      for (let j = 0; j < batch.length; j++) {
        const metric = batch[j];
        const actualIndex = i + j;
        
        try {
          if (!metric.parameterName || !metric.displayName) {
            results.push({
              index: actualIndex,
              success: false,
              error: "Missing required fields (parameterName or displayName)",
              metric: metric
            });
            continue;
          }

          if (options.checkDuplicates && existingNames.includes(metric.parameterName.toLowerCase())) {
            results.push({
              index: actualIndex,
              success: false,
              error: "Custom metric already exists",
              metric: metric,
              skipped: true
            });
            continue;
          }

          const payload = {
            parameterName: metric.parameterName,
            displayName: metric.displayName,
            scope: "EVENT", // Metrics are always EVENT scoped
            description: metric.description || "",
            measurementUnit: metric.measurementUnit || "STANDARD"
          };

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
          
          results.push({
            index: actualIndex,
            success: responseCode >= 200 && responseCode < 300,
            statusCode: responseCode,
            response: responseText,
            metric: metric,
            created: responseCode >= 200 && responseCode < 300 ? JSON.parse(responseText) : null
          });

        } catch (error) {
          results.push({
            index: actualIndex,
            success: false,
            error: error.toString(),
            metric: metric
          });
        }
      }

      if (i + batchSize < metrics.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    const summary = {
      total: metrics.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success && !r.skipped).length,
      skipped: results.filter(r => r.skipped).length
    };

    return { 
      success: true, 
      results: results,
      summary: summary
    };

  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function handleCreateResults(result, type) {
  document.getElementById('processLoader').style.display = 'none';
  document.getElementById('createBtn').disabled = false;

  if (result.success) {
    displayResults(result, type);
    if (selectedPropertyId) {
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

function displayResults(result, type) {
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
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = `<div class="results"><div class="results-header"><p class="error"><strong>Error:</strong> ${message}</p></div></div>`;
  resultsDiv.style.display = 'block';
}

function showSuccess(message) {
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = `<div class="results"><div class="results-header"><p class="success">${message}</p></div></div>`;
  resultsDiv.style.display = 'block';
  setTimeout(() => {
    resultsDiv.style.display = 'none';
  }, 3000);
}

function handleError(error) {
  document.getElementById('processLoader').style.display = 'none';
  document.getElementById('propertyLoader').style.display = 'none';
  document.getElementById('createBtn').disabled = false;
  document.getElementById('loadPropsBtn').disabled = false;
  showError(error.toString());
}

const ga4Manager = new GA4Manager();

// Global variables
let selectedPropertyId = null;
let dimensions = [];
let metrics = [];
let existingDimensions = [];
let existingMetrics = [];
let currentTab = 'dimensions'; // Track current tab

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  event.target.classList.add('active');
  document.getElementById(tabName + '-tab').classList.add('active');
  
  currentTab = tabName;
  updateCreateButton();
}

async function loadProperties() {
  if (!ga4Manager.isAuthenticated) {
    await ga4Manager.authenticate();
    return;
  }

  document.getElementById('propertyLoader').style.display = 'block';
  document.getElementById('loadPropsBtn').disabled = true;
  
  try {
    const result = await getPropertiesList();
    handlePropertiesLoaded(result);
  } catch (error) {
    handleError(error);
  }
}

async function getPropertiesList() {
  try {
    const accountsUrl = "https://analyticsadmin.googleapis.com/v1beta/accounts";
    const accountsData = await ga4Manager.makeApiCall(accountsUrl);
    const accounts = accountsData.accounts || [];

    const allProps = [];

    for (const account of accounts) {
      const accountId = account.name.split("/")[1];
      const accountName = account.displayName;
      
      const propsUrl = `https://analyticsadmin.googleapis.com/v1beta/properties?filter=parent:accounts/${accountId}`;
      const propsData = await ga4Manager.makeApiCall(propsUrl);
      const properties = propsData.properties || [];

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

    return { success: true, properties: allProps };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function handlePropertiesLoaded(result) {
  document.getElementById('propertyLoader').style.display = 'none';
  document.getElementById('loadPropsBtn').disabled = false;
  
  if (result.success) {
    const select = document.getElementById('propertySelect');
    select.innerHTML = '<option value="">Select a GA4 Property...</option>';
    
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
    
    select.style.display = 'block';
  } else {
    showError('Failed to load properties: ' + result.error);
  }
}

function onPropertyChange() {
  selectedPropertyId = document.getElementById('propertySelect').value;
  
  if (selectedPropertyId) {
    loadExistingDimensions();
    loadExistingMetrics();
    updateCreateButton();
  }
}

async function loadExistingDimensions() {
  try {
    const result = await getExistingCustomDimensions(selectedPropertyId);
    if (result.success) {
      existingDimensions = result.dimensions;
      displayExistingDimensions();
    }
  } catch (error) {
    handleError(error);
  }
}

async function loadExistingMetrics() {
  try {
    const result = await getExistingCustomMetrics(selectedPropertyId);
    if (result.success) {
      existingMetrics = result.metrics;
      displayExistingMetrics();
    }
  } catch (error) {
    handleError(error);
  }
}

async function getExistingCustomDimensions(propertyId) {
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

    return { success: true, dimensions: dimensions };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

async function getExistingCustomMetrics(propertyId) {
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

    return { success: true, metrics: metrics };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function displayExistingDimensions() {
  const container = document.getElementById('existingDimensions');
  if (existingDimensions.length > 0) {
    let html = '<div class="existing-dimensions">';
    html += `<h4>Existing Custom Dimensions (${existingDimensions.length})</h4>`;
    html += '<div style="max-height: 150px; overflow-y: auto; font-size: 13px;">';
    existingDimensions.forEach(dim => {
      html += `<div>${dim.displayName} (${dim.parameterName}) - ${dim.scope}</div>`;
    });
    html += '</div></div>';
    container.innerHTML = html;
    container.style.display = 'block';
  } else {
    container.style.display = 'none';
  }
}

function displayExistingMetrics() {
  const container = document.getElementById('existingMetrics');
  if (existingMetrics.length > 0) {
    let html = '<div class="existing-metrics">';
    html += `<h4>Existing Custom Metrics (${existingMetrics.length})</h4>`;
    html += '<div style="max-height: 150px; overflow-y: auto; font-size: 13px;">';
    existingMetrics.forEach(metric => {
      html += `<div>${metric.displayName} (${metric.parameterName}) - ${metric.measurementUnit}</div>`;
    });
    html += '</div></div>';
    container.innerHTML = html;
    container.style.display = 'block';
  } else {
    container.style.display = 'none';
  }
}

// Dimension functions
function addManualDimension() {
  const displayName = document.getElementById('manualDisplayName').value.trim();
  const parameterName = document.getElementById('manualParameterName').value.trim();
  const description = document.getElementById('manualDescription').value.trim();
  const scope = document.getElementById('manualScope').value;

  if (!displayName || !parameterName) {
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
  
  document.getElementById('manualDisplayName').value = '';
  document.getElementById('manualParameterName').value = '';
  document.getElementById('manualDescription').value = '';
  document.getElementById('manualScope').value = 'EVENT';

  updateDimensionList();
  updateCreateButton();
}

// Metric functions
function addManualMetric() {
  const displayName = document.getElementById('metricManualDisplayName').value.trim();
  const parameterName = document.getElementById('metricManualParameterName').value.trim();
  const description = document.getElementById('metricManualDescription').value.trim();
  const measurementUnit = document.getElementById('metricManualUnit').value;

  if (!displayName || !parameterName) {
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
  
  document.getElementById('metricManualDisplayName').value = '';
  document.getElementById('metricManualParameterName').value = '';
  document.getElementById('metricManualDescription').value = '';
  document.getElementById('metricManualUnit').value = 'STANDARD';

  updateMetricList();
  updateCreateButton();
}

function generateSample() {
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
        displayName: "Revenue Per User",
        parameterName: "revenue_per_user",
        description: "Average revenue generated per user",
        measurementUnit: "CURRENCY",
        scope: "EVENT",
        source: 'sample'
      },
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
  event.preventDefault();
  event.currentTarget.classList.add('dragover');
}

function handleFileDrop(event) {
  event.preventDefault();
  event.currentTarget.classList.remove('dragover');
  
  const files = event.dataTransfer.files;
  if (files.length > 0) {
    handleFile(files[0], 'csv');
  }
}

function handleFileSelect(event, format) {
  const file = event.target.files[0];
  if (file) {
    handleFile(file, format);
  }
}

function handleFile(file, format) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const content = e.target.result;
    
    if (format === 'csv') {
      const csvData = parseCSV(content);
      processInputData(csvData, 'csv');
    }
  };
  reader.readAsText(file);
}

function parseCSV(csv) {
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
  
  return result;
}

function processInputData(data, format) {
  try {
    const result = parseInput(data, format);
    if (result.success) {
      if (currentTab === 'dimensions') {
        dimensions = dimensions.concat(result.dimensions.map(d => ({...d, source: format})));
        updateDimensionList();
        showSuccess(`Added ${result.dimensions.length} dimensions from ${format.toUpperCase()}`);
      } else {
        metrics = metrics.concat(result.metrics.map(m => ({...m, source: format})));
        updateMetricList();
        showSuccess(`Added ${result.metrics.length} metrics from ${format.toUpperCase()}`);
      }
      updateCreateButton();
    } else {
      showError('Parse error: ' + result.error);
    }
  } catch (error) {
    handleError(error);
  }
}

function parseInput(inputData, format) {
  try {
    switch (format) {
      case 'csv':
        return currentTab === 'dimensions' ? parseCSVDataDimensions(inputData) : parseCSVDataMetrics(inputData);
      case 'manual':
        return { success: true, [currentTab]: inputData };
      default:
        return { success: false, error: "Unsupported format" };
    }
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function parseCSVDataDimensions(csvData) {
  if (!csvData || csvData.length < 2) {
    return { success: false, error: "CSV must have header row and at least one data row" };
  }

  const headers = csvData[0].map(h => h.toLowerCase().trim());
  const dimensions = [];

  const headerMap = {
    displayName: findHeader(headers, ['display name', 'displayname', 'name', 'dimension name']),
    parameterName: findHeader(headers, ['parameter name', 'parametername', 'parameter', 'key']),
    description: findHeader(headers, ['description', 'desc', 'notes']),
    scope: findHeader(headers, ['scope', 'type']),
    create: findHeader(headers, ['ga4 custom dimension', 'create', 'include', 'enabled'])
  };

  for (let i = 1; i < csvData.length; i++) {
    const row = csvData[i];
    
    const shouldCreate = headerMap.create !== -1 ? 
      String(row[headerMap.create]).toLowerCase().includes('true') : true;
    
    if (!shouldCreate) continue;

    if (headerMap.displayName !== -1 && headerMap.parameterName !== -1) {
      dimensions.push({
        displayName: row[headerMap.displayName] || '',
        parameterName: row[headerMap.parameterName] || '',
        description: headerMap.description !== -1 ? (row[headerMap.description] || '') : '',
        scope: headerMap.scope !== -1 ? (row[headerMap.scope] || 'EVENT') : 'EVENT',
        disallowAdsPersonalization: false
      });
    }
  }

  return { success: true, dimensions: dimensions };
}

function parseCSVDataMetrics(csvData) {
  if (!csvData || csvData.length < 2) {
    return { success: false, error: "CSV must have header row and at least one data row" };
  }

  const headers = csvData[0].map(h => h.toLowerCase().trim());
  const metrics = [];

  const headerMap = {
    displayName: findHeader(headers, ['display name', 'displayname', 'name', 'metric name']),
    parameterName: findHeader(headers, ['parameter name', 'parametername', 'parameter', 'key']),
    description: findHeader(headers, ['description', 'desc', 'notes']),
    measurementUnit: findHeader(headers, ['measurement unit', 'measurementunit', 'unit', 'type']),
    create: findHeader(headers, ['ga4 custom metric', 'create', 'include', 'enabled'])
  };

  for (let i = 1; i < csvData.length; i++) {
    const row = csvData[i];
    
    const shouldCreate = headerMap.create !== -1 ? 
      String(row[headerMap.create]).toLowerCase().includes('true') : true;
    
    if (!shouldCreate) continue;

    if (headerMap.displayName !== -1 && headerMap.parameterName !== -1) {
      metrics.push({
        displayName: row[headerMap.displayName] || '',
        parameterName: row[headerMap.parameterName] || '',
        description: headerMap.description !== -1 ? (row[headerMap.description] || '') : '',
        measurementUnit: headerMap.measurementUnit !== -1 ? (row[headerMap.measurementUnit] || 'STANDARD') : 'STANDARD',
        scope: 'EVENT'
      });
    }
  }

  return { success: true, metrics: metrics };
}

function findHeader(headers, searchTerms) {
  for (let term of searchTerms) {
    const index = headers.findIndex(h => h.includes(term));
    if (index !== -1) return index;
  }
  return -1;
}

function downloadTemplate(format) {
  const template = generateSampleTemplate(format);
  const blob = new Blob([template], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ga4-${currentTab}-template.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

function generateSampleTemplate(format) {
  const sampleDimensions = [
    {
      displayName: "User Type",
      parameterName: "user_type", 
      description: "Identifies if user is new or returning",
      scope: "USER"
    },
    {
      displayName: "Page Category",
      parameterName: "page_category",
      description: "Category of the page being viewed", 
      scope: "EVENT"
    },
    {
      displayName: "Product Brand",
      parameterName: "product_brand",
      description: "Brand of the product",
      scope: "ITEM"
    }
  ];

  const sampleMetrics = [
    {
      displayName: "Revenue Per User",
      parameterName: "revenue_per_user",
      description: "Average revenue generated per user",
      measurementUnit: "CURRENCY"
    },
    {
      displayName: "Page Load Time",
      parameterName: "page_load_time",
      description: "Time taken to load the page",
      measurementUnit: "MILLISECONDS"
    },
    {
      displayName: "Video Watch Duration",
      parameterName: "video_watch_duration",
      description: "Duration of video watched",
      measurementUnit: "SECONDS"
    }
  ];
  
  switch (format) {
    case 'csv':
      if (currentTab === 'dimensions') {
        let csv = "Display Name,Parameter Name,Description,Scope,GA4 Custom Dimension\n";
        sampleDimensions.forEach(item => {
          csv += `"${item.displayName}","${item.parameterName}","${item.description}","${item.scope}","true"\n`;
        });
        return csv;
      } else {
        let csv = "Display Name,Parameter Name,Description,Measurement Unit,GA4 Custom Metric\n";
        sampleMetrics.forEach(item => {
          csv += `"${item.displayName}","${item.parameterName}","${item.description}","${item.measurementUnit}","true"\n`;
        });
        return csv;
      }
    
    default:
      return JSON.stringify(currentTab === 'dimensions' ? sampleDimensions : sampleMetrics, null, 2);
  }
}

function updateDimensionList() {
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
  dimensions.splice(index, 1);
  updateDimensionList();
  updateCreateButton();
}

function removeMetric(index) {
  metrics.splice(index, 1);
  updateMetricList();
  updateCreateButton();
}

function clearAllDimensions() {
  if (confirm('Are you sure you want to clear all dimensions?')) {
    dimensions = [];
    updateDimensionList();
    updateCreateButton();
  }
}

function clearAllMetrics() {
  if (confirm('Are you sure you want to clear all metrics?')) {
    metrics = [];
    updateMetricList();
    updateCreateButton();
  }
}

function validateAllDimensions() {
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
  
  return { errors, warnings };
}

function validateMetrics(metrics) {
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
  
  return { errors, warnings };
}

function updateCreateButton() {
  const createBtn = document.getElementById('createBtn');
  const itemsCount = currentTab === 'dimensions' ? dimensions.length : metrics.length;
  createBtn.disabled = !selectedPropertyId || itemsCount === 0;
  
  // Update button text based on current tab
  if (currentTab === 'dimensions') {
    createBtn.textContent = `Create ${dimensions.length} Custom Dimensions`;
  } else {
    createBtn.textContent = `Create ${metrics.length} Custom Metrics`;
  }
}