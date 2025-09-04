// Scalable Backend - Code.gs

function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .setTitle('GA4 Custom Dimensions Manager');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// Cache properties for better performance
function getPropertiesList() {
  try {
    // Check cache first (30 minutes)
    const cache = CacheService.getScriptCache();
    const cached = cache.get('properties_list');
    if (cached) {
      return JSON.parse(cached);
    }

    const token = ScriptApp.getOAuthToken();
    const options = {
      method: "get",
      headers: { Authorization: "Bearer " + token }
    };

    const accountsUrl = "https://analyticsadmin.googleapis.com/v1beta/accounts";
    const accountsResp = UrlFetchApp.fetch(accountsUrl, options);
    const accounts = JSON.parse(accountsResp.getContentText()).accounts || [];

    const allProps = [];

    accounts.forEach(function(account) {
      const accountId = account.name.split("/")[1];
      const accountName = account.displayName;
      
      const propsUrl = `https://analyticsadmin.googleapis.com/v1beta/properties?filter=parent:accounts/${accountId}`;
      const propsResp = UrlFetchApp.fetch(propsUrl, options);
      const properties = JSON.parse(propsResp.getContentText()).properties || [];

      properties.forEach(function(prop) {
        allProps.push({ 
          name: prop.displayName, 
          id: prop.name.split("/")[1],
          accountName: accountName,
          accountId: accountId,
          propertyType: prop.propertyType || 'PROPERTY_TYPE_ORDINARY'
        });
      });
    });

    // Cache for 30 minutes
    cache.put('properties_list', JSON.stringify({ success: true, properties: allProps }), 1800);
    
    return { success: true, properties: allProps };
    
  } catch (error) {
    Logger.log("Error in getPropertiesList: " + error.toString());
    return { success: false, error: error.toString() };
  }
}

// Get existing custom dimensions for a property
function getExistingCustomDimensions(propertyId) {
  try {
    const token = ScriptApp.getOAuthToken();
    const options = {
      method: "get",
      headers: { Authorization: "Bearer " + token }
    };

    const url = `https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}/customDimensions`;
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());
    
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
    Logger.log("Error getting existing dimensions: " + error.toString());
    return { success: false, error: error.toString() };
  }
}

// Batch create custom dimensions with better error handling
function createCustomDimensions(propertyId, dimensions, options = {}) {
  if (!propertyId || !dimensions || dimensions.length === 0) {
    return { success: false, error: "Invalid input parameters." };
  }

  const results = [];
  const batchSize = options.batchSize || 10; // Process in batches
  const delay = options.delay || 1000; // Delay between batches (ms)
  
  try {
    // Get existing dimensions to check for duplicates
    const existingResult = getExistingCustomDimensions(propertyId);
    const existingNames = existingResult.success ? 
      existingResult.dimensions.map(d => d.parameterName.toLowerCase()) : [];

    for (let i = 0; i < dimensions.length; i += batchSize) {
      const batch = dimensions.slice(i, i + batchSize);
      
      batch.forEach((dimension, index) => {
        const actualIndex = i + index;
        
        try {
          // Validate dimension
          if (!dimension.parameterName || !dimension.displayName) {
            results.push({
              index: actualIndex,
              success: false,
              error: "Missing required fields (parameterName or displayName)",
              dimension: dimension
            });
            return;
          }

          // Check for duplicates
          if (options.checkDuplicates && existingNames.includes(dimension.parameterName.toLowerCase())) {
            results.push({
              index: actualIndex,
              success: false,
              error: "Custom dimension already exists",
              dimension: dimension,
              skipped: true
            });
            return;
          }

          // Prepare payload
          const payload = {
            parameterName: dimension.parameterName,
            displayName: dimension.displayName,
            scope: dimension.scope || "EVENT",
            description: dimension.description || "",
            disallowAdsPersonalization: dimension.disallowAdsPersonalization || false
          };

          const requestOptions = {
            method: "post",
            contentType: "application/json",
            payload: JSON.stringify(payload),
            headers: {
              Authorization: "Bearer " + ScriptApp.getOAuthToken()
            },
            muteHttpExceptions: true
          };

          const url = `https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}/customDimensions`;
          const response = UrlFetchApp.fetch(url, requestOptions);
          
          const responseCode = response.getResponseCode();
          const responseText = response.getContentText();
          
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
      });

      // Add delay between batches to avoid rate limits
      if (i + batchSize < dimensions.length) {
        Utilities.sleep(delay);
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
    Logger.log("Error in createCustomDimensions: " + error.toString());
    return { success: false, error: error.toString() };
  }
}

// Parse different input formats
function parseInput(inputData, format) {
  try {
    switch (format) {
      case 'csv':
        return parseCSVData(inputData);
      case 'json':
        return parseJSONData(inputData);
      case 'excel':
        return parseExcelData(inputData);
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

  // Flexible header mapping
  const headerMap = {
    displayName: findHeader(headers, ['display name', 'displayname', 'name', 'dimension name']),
    parameterName: findHeader(headers, ['parameter name', 'parametername', 'parameter', 'key']),
    description: findHeader(headers, ['description', 'desc', 'notes']),
    scope: findHeader(headers, ['scope', 'type']),
    create: findHeader(headers, ['ga4 custom dimension', 'create', 'include', 'enabled'])
  };

  for (let i = 1; i < csvData.length; i++) {
    const row = csvData[i];
    
    // Check if this row should be processed
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

function parseJSONData(jsonString) {
  const data = JSON.parse(jsonString);
  
  if (Array.isArray(data)) {
    return { success: true, dimensions: data };
  } else if (data.dimensions && Array.isArray(data.dimensions)) {
    return { success: true, dimensions: data.dimensions };
  } else {
    return { success: false, error: "Invalid JSON format" };
  }
}

function parseExcelData(excelData) {
  // Similar to CSV parsing but handles Excel-specific formatting
  return parseCSVData(excelData);
}

function findHeader(headers, searchTerms) {
  for (let term of searchTerms) {
    const index = headers.findIndex(h => h.includes(term));
    if (index !== -1) return index;
  }
  return -1;
}

// Validate dimensions before creation
function validateDimensions(dimensions) {
  const errors = [];
  const warnings = [];
  
  dimensions.forEach((dim, index) => {
    // Required fields
    if (!dim.displayName) {
      errors.push(`Row ${index + 1}: Display name is required`);
    }
    if (!dim.parameterName) {
      errors.push(`Row ${index + 1}: Parameter name is required`);
    }
    
    // Parameter name validation
    if (dim.parameterName && !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(dim.parameterName)) {
      errors.push(`Row ${index + 1}: Parameter name must start with letter and contain only letters, numbers, and underscores`);
    }
    
    // Length limits
    if (dim.displayName && dim.displayName.length > 82) {
      warnings.push(`Row ${index + 1}: Display name is longer than 82 characters`);
    }
    if (dim.description && dim.description.length > 150) {
      warnings.push(`Row ${index + 1}: Description is longer than 150 characters`);
    }
    
    // Scope validation
    if (dim.scope && !['EVENT', 'USER', 'ITEM'].includes(dim.scope)) {
      warnings.push(`Row ${index + 1}: Invalid scope. Using EVENT as default`);
      dim.scope = 'EVENT';
    }
  });
  
  return { errors, warnings };
}

// Generate sample templates
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
    
    case 'json':
      return JSON.stringify({ dimensions: sampleData }, null, 2);
    
    default:
      return sampleData;
  }
}