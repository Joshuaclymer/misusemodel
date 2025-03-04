import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import * as math from 'mathjs';

const CrimeModelInterface = () => {
  // Distribution parameters
  const [medianMonths, setMedianMonths] = useState(6);
  const [percentile99, setPercentile99] = useState(24);
  const [alphaParam, setAlphaParam] = useState(2);
  const [betaParam, setBetaParam] = useState(5);

  // Success curve parameters
  const [success2Months, setSuccess2Months] = useState(20);
  const [success6Months, setSuccess6Months] = useState(50);
  const [success3Years, setSuccess3Years] = useState(90);
  
  // Scale parameters
  const [annualAttempts, setAnnualAttempts] = useState(1000);
  const [expectedDamage, setExpectedDamage] = useState(500000);
  
  // Calculated results
  const [totalAnnualDamage, setTotalAnnualDamage] = useState(0);
  const [overallSuccessRate, setOverallSuccessRate] = useState(0);
  
  // Chart data
  const [distributionData, setDistributionData] = useState([]);
  const [successCurveData, setSuccessCurveData] = useState([]);
  const [comboCurveData, setComboCurveData] = useState([]);
  const [damageDistributionData, setDamageDistributionData] = useState([]);
  
  // State
  const [error, setError] = useState("");
  const [maxMonths, setMaxMonths] = useState(36);
  const [activeTab, setActiveTab] = useState("distribution");

  // Beta distribution PDF function
  const betaPDF = (x, alpha, beta) => {
    if (x <= 0 || x >= 1) return 0;
    
    try {
      // Calculate beta function B(alpha, beta)
      const lnBeta = math.lgamma(alpha) + math.lgamma(beta) - math.lgamma(alpha + beta);
      const betaFunc = Math.exp(lnBeta);
      
      // Calculate PDF
      return Math.pow(x, alpha - 1) * Math.pow(1 - x, beta - 1) / betaFunc;
    } catch (err) {
      return 0;
    }
  };

  // Function to estimate beta parameters from median and 99th percentile
  const estimateBetaParameters = (median, p99) => {
    // Validate inputs
    if (median >= p99 || median <= 0 || p99 <= 0) {
      setError("Median must be less than 99th percentile and both must be positive");
      return null;
    }

    setError(""); // Clear any previous error if validation passes

    // Calculate maximum months to scale our distribution
    const newMaxMonths = Math.max(p99 * 1.1, 36);
    setMaxMonths(newMaxMonths);

    // Convert months to normalized values between 0 and 1
    const x50 = median / newMaxMonths;
    const x99 = p99 / newMaxMonths;

    // For beta distribution, median ≈ alpha/(alpha+beta) when alpha,beta > 1
    let alpha, beta;

    // Right-skewed distribution (what we expect for most criminal behavior)
    // For right-skewed, alpha < beta
    
    // Starting with reasonable parameters
    alpha = 2;
    
    // Calculate beta based on median
    beta = alpha * (1/x50 - 1);
    
    // Now adjust both to match the 99th percentile
    const ratio = alpha / beta;
    
    // Increase or decrease both parameters proportionally to get a tighter or wider distribution
    const targetX99 = 0.99;
    const currentSpread = x99 - x50;
    const targetSpread = targetX99 - 0.5;
    const scaleFactor = targetSpread / currentSpread;
    
    alpha = Math.max(0.5, alpha * scaleFactor);
    beta = alpha / ratio;
    
    // Ensure parameters are positive and reasonable
    alpha = Math.max(0.5, alpha);
    beta = Math.max(0.5, beta);
    
    setAlphaParam(alpha);
    setBetaParam(beta);
    
    return { alpha, beta };
  };

  // Function to generate distribution data with logarithmic x-axis
  const generateDistributionData = (alpha, beta) => {
    const points = 100;
    const data = [];
    
    for (let i = 0; i <= points; i++) {
      // Logarithmic distribution of points along x-axis
      const logFactor = Math.exp(Math.log(maxMonths) * i / points);
      const months = Math.max(0.1, logFactor); // Avoid zero
      const x = months / maxMonths;
      
      // Calculate beta PDF
      const density = betaPDF(x, alpha, beta);
      
      // Scale density for display
      const scaledDensity = density / maxMonths;
      
      data.push({
        months: parseFloat(months.toFixed(2)),
        probability: scaledDensity > 0 ? scaledDensity : 0
      });
    }

    return data;
  };

  // Function to generate success curve data (S-curve using logistic function)
  const generateSuccessCurveData = () => {
    // Convert percentage to proportion
    const p1 = success2Months / 100;
    const p2 = success6Months / 100;
    const p3 = success3Years / 100;
    
    // Time points in months
    const t1 = 2;    // 2 months
    const t2 = 6;    // 6 months
    const t3 = 36;   // 3 years (36 months)
    
    // Fit logistic function parameters
    // P(success) = 1 / (1 + e^-(a + b*log(time)))
    // We're using a logarithmic time transformation to get a better S-curve
    
    // Start with a simple approach using two points (t1,p1) and (t3,p3)
    const logT1 = Math.log(t1);
    const logT3 = Math.log(t3);
    
    // Convert probabilities to logit space
    const logit = (p) => Math.log(p / (1 - p));
    
    // Avoid extreme values of 0 or 1
    const safeP1 = p1 === 0 ? 0.01 : (p1 === 1 ? 0.99 : p1);
    const safeP3 = p3 === 0 ? 0.01 : (p3 === 1 ? 0.99 : p3);
    
    const l1 = logit(safeP1);
    const l3 = logit(safeP3);
    
    // Solve for a and b in: l = a + b*log(t)
    const b = (l3 - l1) / (logT3 - logT1);
    const a = l1 - b * logT1;
    
    // Generate curve points
    const points = 100;
    const data = [];
    
    for (let i = 0; i <= points; i++) {
      // Logarithmic distribution of points along x-axis
      const logFactor = Math.exp(Math.log(maxMonths) * i / points);
      const months = Math.max(0.1, logFactor); // Avoid zero
      
      // Calculate success probability at this time point
      const logTime = Math.log(months);
      const logitP = a + b * logTime;
      const successProb = 1 / (1 + Math.exp(-logitP));
      
      data.push({
        months: parseFloat(months.toFixed(2)),
        successRate: Math.max(0, Math.min(1, successProb))
      });
    }
    
    return data;
  };

  // Function to generate combined curve data
  // This computes P(success) × distribution = expected success density
  const generateComboCurveData = (distributionData, successCurveData) => {
    if (!distributionData.length || !successCurveData.length) return [];
    
    // Create a function to lookup success rate at a given month
    const getSuccessRate = (months) => {
      // Find the closest point in the success curve data
      const point = successCurveData.reduce((closest, current) => {
        return Math.abs(current.months - months) < Math.abs(closest.months - months) ? current : closest;
      }, successCurveData[0]);
      
      return point.successRate;
    };
    
    // Generate combo data
    return distributionData.map(point => {
      const successRate = getSuccessRate(point.months);
      return {
        months: point.months,
        expectedSuccess: point.probability * successRate
      };
    });
  };
  
  // Function to generate damage distribution data
  const generateDamageDistributionData = (comboCurveData) => {
    if (!comboCurveData.length) return [];
    
    // Calculate total area under the combo curve (expected success rate)
    // We'll use trapezoidal rule for integration
    let totalArea = 0;
    for (let i = 1; i < comboCurveData.length; i++) {
      const width = comboCurveData[i].months - comboCurveData[i-1].months;
      const avgHeight = (comboCurveData[i].expectedSuccess + comboCurveData[i-1].expectedSuccess) / 2;
      totalArea += width * avgHeight;
    }
    
    setOverallSuccessRate(totalArea);
    
    // Calculate expected annual damage
    const totalDamage = annualAttempts * totalArea * expectedDamage;
    setTotalAnnualDamage(totalDamage);
    
    // Generate distribution of damages by timeframe (for the bar chart)
    // We'll divide the time range into 10 buckets on a log scale
    const numBuckets = 10;
    const buckets = [];
    
    // Create the bucket boundaries
    const minLog = Math.log(0.1);  // Start at 0.1 months
    const maxLog = Math.log(maxMonths);
    const logStep = (maxLog - minLog) / numBuckets;
    
    for (let i = 0; i < numBuckets; i++) {
      const logLower = minLog + i * logStep;
      const logUpper = minLog + (i + 1) * logStep;
      const lowerMonths = Math.exp(logLower);
      const upperMonths = Math.exp(logUpper);
      
      buckets.push({
        id: i,
        label: `${lowerMonths.toFixed(1)}-${upperMonths.toFixed(1)} mo`,
        startMonths: lowerMonths,
        endMonths: upperMonths,
        damage: 0,
        percentage: 0
      });
    }
    
    // Distribute the damage to buckets
    for (let i = 1; i < comboCurveData.length; i++) {
      const width = comboCurveData[i].months - comboCurveData[i-1].months;
      const avgHeight = (comboCurveData[i].expectedSuccess + comboCurveData[i-1].expectedSuccess) / 2;
      const segmentArea = width * avgHeight;
      const avgMonths = (comboCurveData[i].months + comboCurveData[i-1].months) / 2;
      
      // Find the bucket this segment belongs to
      const bucket = buckets.find(b => avgMonths >= b.startMonths && avgMonths < b.endMonths);
      if (bucket) {
        // Add this segment's contribution to the bucket's damage
        bucket.damage += segmentArea * annualAttempts * expectedDamage;
      }
    }
    
    // Calculate percentages
    buckets.forEach(bucket => {
      bucket.percentage = (bucket.damage / totalDamage) * 100;
    });
    
    return buckets;
  };

  // Handle refresh button click
  const handleRefresh = () => {
    // Update time distribution
    const params = estimateBetaParameters(medianMonths, percentile99);
    if (params) {
      const { alpha, beta } = params;
      const distData = generateDistributionData(alpha, beta);
      setDistributionData(distData);
      
      // Update success curve
      const successData = generateSuccessCurveData();
      setSuccessCurveData(successData);
      
      // Generate combo curve
      const comboData = generateComboCurveData(distData, successData);
      setComboCurveData(comboData);
      
      // Generate damage distribution
      const damageData = generateDamageDistributionData(comboData);
      setDamageDistributionData(damageData);
    }
  };

  // Initialize chart on first load
  useEffect(() => {
    handleRefresh();
  }, []); // Empty dependency array means this runs once on mount

  // Handle input changes - no validation, just update the state
  const handleInputChange = (value, setter) => {
    // Allow any input, including empty string which will be parsed as NaN
    const numValue = parseFloat(value);
    // Only update if it's a valid number
    if (!isNaN(numValue)) {
      setter(numValue);
    } else if (value === '') {
      // Handle empty input by allowing it (the field will be empty)
      setter('');
    }
  };

  // Format functions
  const formatXAxis = (tickItem) => tickItem.toFixed(1);
  const formatSuccessRate = (value) => `${(value * 100).toFixed(1)}%`;
  const formatCurrency = (value) => `$${Math.round(value).toLocaleString()}`;
  const formatPercentage = (value) => `${value.toFixed(1)}%`;

  // Render the currently selected tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case "distribution":
        return (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={distributionData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="months" 
                  scale="log"
                  domain={['auto', 'auto']}
                  type="number"
                  allowDataOverflow={true}
                  tickFormatter={formatXAxis}
                  label={{ value: 'Months Willing to Attempt Crime (log scale)', position: 'insideBottomRight', offset: -5 }} 
                />
                <YAxis 
                  label={{ value: 'Probability Density', angle: -90, position: 'insideLeft' }} 
                />
                <Tooltip formatter={(value) => [value.toFixed(4), 'Probability Density']} labelFormatter={(label) => `${label} months`} />
                <Line type="monotone" dataKey="probability" stroke="#8884d8" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      
      case "success":
        return (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={successCurveData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="months" 
                  scale="log"
                  domain={['auto', 'auto']}
                  type="number"
                  allowDataOverflow={true}
                  tickFormatter={formatXAxis}
                  label={{ value: 'Months Attempting Crime (log scale)', position: 'insideBottomRight', offset: -5 }} 
                />
                <YAxis 
                  domain={[0, 1]}
                  tickFormatter={formatSuccessRate}
                  label={{ value: 'Success Probability', angle: -90, position: 'insideLeft' }} 
                />
                <Tooltip 
                  formatter={(value) => [`${(value * 100).toFixed(1)}%`, 'Success Probability']} 
                  labelFormatter={(label) => `${label} months`} 
                />
                <Line type="monotone" dataKey="successRate" stroke="#82ca9d" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      
      case "combined":
        return (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={comboCurveData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="months" 
                  scale="log"
                  domain={['auto', 'auto']}
                  type="number"
                  allowDataOverflow={true}
                  tickFormatter={formatXAxis}
                  label={{ value: 'Months (log scale)', position: 'insideBottomRight', offset: -5 }} 
                />
                <YAxis 
                  label={{ value: 'Expected Success Density', angle: -90, position: 'insideLeft' }} 
                />
                <Tooltip formatter={(value) => [value.toFixed(6), 'Expected Success Density']} labelFormatter={(label) => `${label} months`} />
                <Line type="monotone" dataKey="expectedSuccess" stroke="#ff7300" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      
      case "damage":
        return (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={damageDistributionData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="label"
                  label={{ value: 'Time Range (months)', position: 'insideBottomRight', offset: -5 }} 
                />
                <YAxis 
                  label={{ value: 'Expected Annual Damage ($)', angle: -90, position: 'insideLeft' }} 
                  tickFormatter={(value) => value.toLocaleString()}
                />
                <Tooltip 
                  formatter={(value) => [formatCurrency(value), 'Expected Damage']} 
                  labelFormatter={(label) => `Time Range: ${label} months`}
                />
                <Bar dataKey="damage" fill="#8884d8">
                  {damageDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`rgb(${Math.min(255, 50 + entry.percentage * 2)}, 120, 200)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      
      default:
        return <div>Select a tab to view data</div>;
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-4">Crime Attempt and Damage Model</h1>
      
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Distribution Parameters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Median (50th percentile) in months
            </label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={medianMonths}
              onChange={(e) => handleInputChange(e.target.value, setMedianMonths)}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              99th Percentile in months
            </label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={percentile99}
              onChange={(e) => handleInputChange(e.target.value, setPercentile99)}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>

        <h2 className="text-lg font-semibold mb-2">Success Curve Parameters</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Success at 2 months (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={success2Months}
              onChange={(e) => handleInputChange(e.target.value, setSuccess2Months)}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Success at 6 months (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={success6Months}
              onChange={(e) => handleInputChange(e.target.value, setSuccess6Months)}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Success at 3 years (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={success3Years}
              onChange={(e) => handleInputChange(e.target.value, setSuccess3Years)}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
        
        <h2 className="text-lg font-semibold mb-2">Scale Parameters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Annual Attempts (N)
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={annualAttempts}
              onChange={(e) => handleInputChange(e.target.value, setAnnualAttempts)}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expected Damage per Success (E[damage])
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">$</span>
              <input
                type="number"
                min="1"
                step="1000"
                value={expectedDamage}
                onChange={(e) => handleInputChange(e.target.value, setExpectedDamage)}
                className="w-full p-2 pl-6 border border-gray-300 rounded-md"
              />
            </div>
          </div>
        </div>
        
        <div className="flex justify-center mt-4">
          <button
            onClick={handleRefresh}
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-md transition-colors"
          >
            Refresh Model
          </button>
        </div>
      </div>
      
      {/* Results summary */}
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-medium text-yellow-800">Model Results</h3>
            <div className="mt-2 text-yellow-700">
              <p>Overall Success Rate: <span className="font-medium">{formatPercentage(overallSuccessRate * 100)}</span></p>
              <p className="mt-1">
                <span className="text-lg font-bold text-yellow-900">
                  Expected Annual Damage: {formatCurrency(totalAnnualDamage)}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          Beta Distribution Parameters: α = {alphaParam.toFixed(2)}, β = {betaParam.toFixed(2)}
        </p>
      </div>
      
      {/* Tab navigation */}
      <div className="mb-4 border-b border-gray-200">
        <nav className="flex flex-wrap">
          <button
            className={`mr-4 py-2 px-4 ${activeTab === "distribution" ? "border-b-2 border-blue-500 font-medium" : "text-gray-500 hover:text-gray-700"}`}
            onClick={() => setActiveTab("distribution")}
          >
            Time Distribution
          </button>
          <button
            className={`mr-4 py-2 px-4 ${activeTab === "success" ? "border-b-2 border-blue-500 font-medium" : "text-gray-500 hover:text-gray-700"}`}
            onClick={() => setActiveTab("success")}
          >
            Success Curve
          </button>
          <button
            className={`mr-4 py-2 px-4 ${activeTab === "combined" ? "border-b-2 border-blue-500 font-medium" : "text-gray-500 hover:text-gray-700"}`}
            onClick={() => setActiveTab("combined")}
          >
            Combined Impact
          </button>
          <button
            className={`mr-4 py-2 px-4 ${activeTab === "damage" ? "border-b-2 border-blue-500 font-medium" : "text-gray-500 hover:text-gray-700"}`}
            onClick={() => setActiveTab("damage")}
          >
            Damage Distribution
          </button>
        </nav>
      </div>
      
      {/* Chart area */}
      {renderTabContent()}
      
      {/* Interpretation */}
      <div className="bg-blue-50 p-4 rounded-md mt-6">
        <h2 className="font-semibold mb-2">Model Interpretation:</h2>
        
        {activeTab === "distribution" && (
          <>
            <p>This curve shows how long individuals are willing to persist in attempting crimes:</p>
            <ul className="list-disc pl-5 mt-2">
              <li>50% of individuals would give up after {medianMonths} months or less</li>
              <li>99% of individuals would give up after {percentile99} months or less</li>
              <li>Only 1% of individuals would persist beyond {percentile99} months</li>
            </ul>
          </>
        )}
        
        {activeTab === "success" && (
          <>
            <p>This S-curve shows the probability of success based on time spent attempting:</p>
            <ul className="list-disc pl-5 mt-2">
              <li>At 2 months: {success2Months}% chance of success</li>
              <li>At 6 months: {success6Months}% chance of success</li>
              <li>At 3 years: {success3Years}% chance of success</li>
            </ul>
            <p className="mt-2">The curve uses a logistic function fitted to these three points.</p>
          </>
        )}
        
        {activeTab === "combined" && (
          <>
            <p>This curve shows the expected distribution of successful crime attempts:</p>
            <ul className="list-disc pl-5 mt-2">
              <li>It multiplies the time distribution by the success probability at each time point</li>
              <li>The area under this curve represents the overall success rate ({formatPercentage(overallSuccessRate * 100)})</li>
              <li>The peak shows the most likely time point for successful crimes</li>
            </ul>
          </>
        )}
        
        {activeTab === "damage" && (
          <>
            <p>This chart shows the distribution of expected annual damage across different time ranges:</p>
            <ul className="list-disc pl-5 mt-2">
              <li>Each bar represents the expected damage from attempts that last within that time range</li>
              <li>Darker bars indicate time ranges with higher damage concentrations</li>
              <li>The sum of all bars equals the total expected annual damage: {formatCurrency(totalAnnualDamage)}</li>
            </ul>
            <p className="mt-2">Based on {annualAttempts.toLocaleString()} annual attempts with an average damage of {formatCurrency(expectedDamage)} per successful attempt.</p>
          </>
        )}
        
        <p className="mt-2 text-sm text-gray-600">
          Note: The x-axis on the line charts uses a logarithmic scale to better visualize the distribution across different time scales.
        </p>
      </div>
    </div>
  );
};

export default CrimeModelInterface;