// GA4 Custom Dimensions Manager - Standalone JavaScript
class GA4Manager {
  constructor() {
    this.accessToken = null;
    this.isAuthenticated = false;
    this.init();
  }

  init() {
    // Initialize Google API when page loads
    gapi.load('auth2', () => {
      gapi.auth2.init({
        client_id: 'YOUR_CLIENT_ID', // Replace with your actual client ID
        scope: 'https://www.googleapis.com/auth/analytics.edit'
      }).then(() => {
        const authInstance = gapi.auth2.getAuthInstance();
        if (authInstance.isSignedIn.get()) {
          this.handleAuthSuccess(authInstance.currentUser.get());
        }
      });
    });
  }

  async authenticate() {
    const authInstance = gapi.auth2.getAuthInstance();
    try {
      const user = await authInstance.signIn();
      this.handleAuthSuccess(user);
    } catch (error) {
      throw new Error('Authentication failed');
    }
  }

  handleAuthSuccess(user) {
    this.isAuthenticated = true;
    this.accessToken = user.getAuthResponse().access_token;
  }

  async makeApiCall(url, options = {}) {
    if (!this.accessToken) {
      await this.authenticate();
    }

    const defaultOptions = {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    const response = await fetch(url, { ...defaultOptions, ...options });
    return response.json();
  }
}

// Initialize the manager
const ga4Manager = new GA4Manager();

// Global variables to maintain compatibility with your HTML
let selectedPropertyId = null;
let dimensions = [];
let existingDimensions = [];

// Tab switching
function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  event.target.classList.add('active');
  document.getElementById(tabName + '-tab').classList.add('active');
}

// Property management
async function loadProperties() {
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
    if (!ga4Manager.isAuthenticated) {
      await ga4Manager.authenticate();
    }

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
    
    // Group by account
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

// Manual dimension entry
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
  
  // Clear form
  document.getElementById('manualDisplayName').value = '';
  document.getElementById('manualParameterName').value = '';
  document.getElementById('manualDescription').value = '';
  document.getElementById('manualScope').value = 'EVENT';

  updateDimensionList();
  updateCreateButton();
}

function generateSample() {
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
  updateCreateButton();
  showSuccess('Added 3 sample dimensions');
}

// File handling
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
      dimensions = dimensions.concat(result.dimensions.map(d => ({...d, source: format})));
      updateDimensionList();
      updateCreateButton();
      showSuccess(`Added ${result.dimensions.length} dimensions from ${format.toUpperCase()}`);
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
        return parseCSVData(inputData);
      case 'manual':
        return { success: true, dimensions: inputData };
      default:
        return { success: false, error: "Unsupported format" };
    }
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function parseCSVData(csvData) {
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
  a.download = `ga4-dimensions-template.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

function generateSampleTemplate(format) {
  const sampleData = [
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
  
  switch (format) {
    case 'csv':
      let csv = "Display Name,Parameter Name,Description,Scope,GA4 Custom Dimension\n";
      sampleData.forEach(item => {
        csv += `"${item.displayName}","${item.parameterName}","${item.description}","${item.scope}","true"\n`;
      });
      return csv;
    
    default:
      return JSON.stringify(sampleData, null, 2);
  }
}

// Dimension management
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

function removeDimension(index) {
  dimensions.splice(index, 1);
  updateDimensionList();
  updateCreateButton();
}

function clearAllDimensions() {
  if (confirm('Are you sure you want to clear all dimensions?')) {
    dimensions = [];
    updateDimensionList();
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

// Creation process
function updateCreateButton() {
  const createBtn = document.getElementById('createBtn');
  createBtn.disabled = !selectedPropertyId || dimensions.length === 0;
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
    const result = await createCustomDimensions(selectedPropertyId, dimensions, options);
    handleCreateResults(result);
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

function handleCreateResults(result) {
  document.getElementById('processLoader').style.display = 'none';
  document.getElementById('createBtn').disabled = false;

  if (result.success) {
    displayResults(result);
    if (selectedPropertyId) {
      loadExistingDimensions();
    }
  } else {
    showError('Creation failed: ' + result.error);
  }
}

function displayResults(result) {
  const resultsDiv = document.getElementById('results');
  const summary = result.summary;
  
  let html = '<div class="results">';
  html += '<div class="results-header">';
  html += '<h3>Results Summary</h3>';
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
    
    html += '<div class="result-item">';
    html += `<div>`;
    html += `<span class="${statusClass}"><strong>${statusIcon}</strong></span> `;
    html += `<strong>${item.dimension.displayName}</strong> (${item.dimension.parameterName})`;
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

// Utility functions
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