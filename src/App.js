import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import jStat from 'jstat';
import * as math from 'mathjs';
import './App.css';

function App() {
  // Reference for the container width
  const containerRef = React.useRef(null);
  const [medianMonths, setMedianMonths] = useState(6);
  const [percentile99, setPercentile99] = useState(24);
  const [distributionData, setDistributionData] = useState([]);
  const [error, setError] = useState('');
  const [inputMedian, setInputMedian] = useState(6);
  const [inputP99, setInputP99] = useState(24);
  
  // Success probability parameters
  const [success2m, setSuccess2m] = useState(20);
  const [success6m, setSuccess6m] = useState(50);
  const [success3y, setSuccess3y] = useState(90);
  
  // Scale parameters
  const [annualAttempts, setAnnualAttempts] = useState(1000);
  const [expectedDamage, setExpectedDamage] = useState(500000);
  
  // Results
  const [totalAnnualDamage, setTotalAnnualDamage] = useState(0);
  const [damageDistribution, setDamageDistribution] = useState([]);
  const [containerWidth, setContainerWidth] = useState(0);

  // Handle window resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    
    window.addEventListener('resize', updateWidth);
    updateWidth(); // Initial width
    
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Initial calculation
  useEffect(() => {
    updateDistribution();
  }, []);

  // Beta distribution PDF function
  const betaPDF = (x, alpha, beta) => {
    if (x <= 0 || x >= 1) return 0;
    try {
      const lnBeta = math.lgamma(alpha) + math.lgamma(beta) - math.lgamma(alpha + beta);
      const betaFunc = Math.exp(lnBeta);
      return Math.pow(x, alpha - 1) * Math.pow(1 - x, beta - 1) / betaFunc;
    } catch (err) {
      return 0;
    }
  };

  // Function to estimate beta parameters from median and 99th percentile
  const estimateBetaParameters = (median, p99) => {
    if (median >= p99 || median <= 0 || p99 <= 0) {
      setError('Median must be less than 99th percentile and both must be positive');
      return null;
    }
    setError('');

    const maxMonths = Math.max(p99 * 1.5, 36); // Extend range a bit beyond p99
    const x50 = median / maxMonths;
    const x99 = p99 / maxMonths;

    // Initial guess for parameters
    let alpha = 2;
    let beta = alpha * (1/x50 - 1);

    // Adjust parameters to match the 99th percentile better
    const ratio = alpha / beta;
    const targetX99 = 0.99;
    const currentSpread = x99 - x50;
    const targetSpread = targetX99 - 0.5;
    const scaleFactor = targetSpread / currentSpread;

    alpha = Math.max(0.5, alpha * scaleFactor);
    beta = alpha / ratio;

    return { alpha, beta, maxMonths };
  };

  // Fit logistic function to three points
  const fitLogisticCurve = (x, points) => {
    // Convert to log scale for better fitting
    const logX = Math.log(x);
    const log2m = Math.log(2);
    const log6m = Math.log(6);
    const log3y = Math.log(36); // 3 years in months
    
    // Simple logistic function: P(x) = 1 / (1 + e^(-k(x - x0)))
    // We'll use the middle point (6 months) as x0
    const x0 = log6m;
    
    // Estimate k using the spread between 2 months and 3 years
    const k = (Math.log(points.y3y/(100-points.y3y)) - Math.log(points.y2m/(100-points.y2m))) / (log3y - log2m);
    
    // Calculate probability
    return 100 / (1 + Math.exp(-k * (logX - x0)));
  };

  const updateDistribution = () => {
    if (inputMedian >= inputP99 || inputMedian <= 0 || inputP99 <= 0) {
      setError('Median must be less than 99th percentile and both must be positive');
      return;
    }
    setError('');
    setMedianMonths(inputMedian);
    setPercentile99(inputP99);

    const params = estimateBetaParameters(inputMedian, inputP99);
    if (!params) return;

    const { alpha, beta, maxMonths } = params;
    const NUM_SAMPLES = 10000; // Increased number of samples for smoother distribution
    const points = [];
    const successPoints = {
      y2m: success2m,
      y6m: success6m,
      y3y: success3y
    };

    // First, calculate the time distribution and success probability points
    for (let i = 0; i <= 100; i++) {
      const x = i / 100;
      const months = Math.exp(x * Math.log(maxMonths)); // Log scale transformation
      const normalizedX = months / maxMonths;
      const y = betaPDF(normalizedX, alpha, beta) / maxMonths; // Scale PDF to match month units
      const successProb = fitLogisticCurve(months, successPoints);
      
      points.push({
        months,
        probability: y,
        successProbability: successProb
      });
    }
    setDistributionData(points);

    // Now calculate damage distribution using Monte Carlo sampling
    const singleAttemptDamages = new Array(NUM_SAMPLES).fill(0).map(() => {
      // Sample from time distribution
      const u = Math.random();
      const months = Math.exp(u * Math.log(maxMonths));
      const normalizedX = months / maxMonths;
      const successProb = fitLogisticCurve(months, successPoints) / 100;
      
      // For each attempt, calculate if it succeeds and the resulting damage
      const succeeds = Math.random() < successProb;
      return succeeds ? expectedDamage : 0;
    });

    // Calculate mean and standard deviation for a single attempt
    const singleMean = singleAttemptDamages.reduce((a, b) => a + b, 0) / NUM_SAMPLES;
    const singleVariance = singleAttemptDamages.reduce((a, b) => a + (b - singleMean) ** 2, 0) / (NUM_SAMPLES - 1);
    const singleStd = Math.sqrt(singleVariance);

    // Use Central Limit Theorem for N attempts
    const totalMean = singleMean * annualAttempts;
    const totalStd = singleStd * Math.sqrt(annualAttempts);
    setTotalAnnualDamage(totalMean);

    // Generate smooth damage distribution using normal approximation
    const damagePoints = new Array(200).fill(0).map((_, i) => {
      const damage = totalMean + totalStd * 3 * (-2 + 4 * (i / 199)); // Range: μ ± 3σ
      const z = (damage - totalMean) / totalStd;
      const probability = Math.exp(-z * z / 2) / (Math.sqrt(2 * Math.PI) * totalStd);
      return {
        damage: Math.max(0, damage),
        probability: probability
      };
    });

    setDamageDistribution(damagePoints);
  };

  return (
    <div className="App" style={{ padding: '20px' }}>
      <div>
        <h1>Crime Attempt Duration Model</h1>
        <form onSubmit={(e) => {
          e.preventDefault();
          updateDistribution();
        }}>
          <div style={{ 
        marginBottom: '20px',
        display: 'flex',
        gap: '40px',
        justifyContent: 'center'
      }}>
        {/* Attempt Effort Distribution */}
        <div>
          <h3>Attempt Effort Distribution</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
            <label>
              50th Percentile (months):
              <input
                type="number"
                value={inputMedian}
                onChange={(e) => setInputMedian(e.target.value === '' ? '' : parseFloat(e.target.value))}
                style={{ marginLeft: '10px' }}
              />
            </label>
            <label>
              99th Percentile (months):
              <input
                type="number"
                value={inputP99}
                onChange={(e) => setInputP99(e.target.value === '' ? '' : parseFloat(e.target.value))}
                style={{ marginLeft: '10px' }}
              />
            </label>
          </div>
        </div>

        {/* Success Probability Distribution */}
        <div>
          <h3>Success Probability Given Effort</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
            <label>
              At 2 Months (%):
              <input
                type="number"
                value={success2m}
                onChange={(e) => setSuccess2m(e.target.value === '' ? '' : parseFloat(e.target.value))}
                style={{ marginLeft: '10px' }}
                min="0"
                max="100"
              />
            </label>
            <label>
              At 6 Months (%):
              <input
                type="number"
                value={success6m}
                onChange={(e) => setSuccess6m(e.target.value === '' ? '' : parseFloat(e.target.value))}
                style={{ marginLeft: '10px' }}
                min="0"
                max="100"
              />
            </label>
            <label>
              At 3 Years (%):
              <input
                type="number"
                value={success3y}
                onChange={(e) => setSuccess3y(e.target.value === '' ? '' : parseFloat(e.target.value))}
                style={{ marginLeft: '10px' }}
                min="0"
                max="100"
              />
            </label>
          </div>
        </div>

        {/* Expected Annual Values */}
        <div>
          <h3>Expected Annual Values</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
            <label>
              Number of Attempts:
              <input
                type="number"
                value={annualAttempts}
                onChange={(e) => setAnnualAttempts(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value)))}
                style={{ marginLeft: '10px' }}
              />
            </label>
            <label>
              Damage per Success ($):
              <input
                type="number"
                value={expectedDamage}
                onChange={(e) => setExpectedDamage(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value)))}
                style={{ marginLeft: '10px' }}
              />
            </label>
          </div>
        </div>

      </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px', marginBottom: '20px' }}>
            <button 
              type="submit"
            style={{
              padding: '8px 16px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Refresh
            </button>
          </div>
          {error && <div style={{ color: 'red', marginTop: '10px' }}>{error}</div>}
        </form>

        <div 
        ref={containerRef}
        style={{ 
          display: 'flex', 
          flexDirection: 'row', 
          gap: '40px', 
          marginTop: '20px',
          justifyContent: 'center',
          maxWidth: '1400px',
          margin: '20px auto'
        }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>Effort Distribution and Conditional Success Probability</h3>
          <LineChart 
            width={Math.min(800, (containerWidth - 80) / 2)} 
            height={350}
            margin={{ top: 5, right: 50, left: 50, bottom: 25 }} data={distributionData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="months"
              scale="log"
              domain={['auto', 'auto']}
              type="number"
              label={{ value: 'Months (log scale)', position: 'bottom', offset: 20 }}
              tickFormatter={(value) => value.toFixed(1)}
            />
            <YAxis
              yAxisId="left"
              label={{ value: 'Probability Density', angle: -90, position: 'center', dx: -35}}
            />
            <Tooltip
              formatter={(value, name) => [value.toFixed(4), name]}
              labelFormatter={(value) => `${value.toFixed(1)} months`}
            />
            <Legend 
              layout="horizontal" 
              align="center" 
              verticalAlign="bottom"
              wrapperStyle={{
                paddingTop: '10px',
                bottom: -10
              }}
            />
            <Line
              type="monotone"
              dataKey="probability"
              stroke="#8884d8"
              name="Effort of Attempts"
              dot={false}
              yAxisId="left"
            />
            <Line
              type="monotone"
              dataKey="successProbability"
              stroke="#2e8b57"
              name="Success Probability Conditional on Effort (%)"
              dot={false}
              yAxisId="right"
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              label={{ value: 'Success Probability (%)', angle: 90, position: 'center', dx: 20}}
            />
          </LineChart>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
          <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>Annual Damage</h3>
          <LineChart 
            width={Math.min(800, (containerWidth - 80) / 2)} 
            height={350}
            margin={{ top: 5, right: 30, left: 50, bottom: 25 }} data={damageDistribution}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="damage"
              type="number"
              label={{ value: 'Annual Damage ($)', position: 'bottom' }}
              tickFormatter={(value) => value.toLocaleString()}
            />
            <YAxis
              label={{ value: 'Probability Density', angle: -90, position: 'center', offset: -40, dx: -50}}
            />
            <Tooltip
              formatter={(value, name) => [value.toFixed(4), name]}
              labelFormatter={(value) => `$${parseInt(value).toLocaleString()}`}
            />
            <Legend 
              layout="horizontal" 
              align="center" 
              verticalAlign="bottom"
              wrapperStyle={{
                paddingTop: '10px',
                bottom: -10
              }}
            />
            <Line
              type="monotone"
              dataKey="probability"
              stroke="#ff7300"
              name="Annual Damage ($)"
              dot={false}
            />
          </LineChart>
        </div>
      </div>

      <div style={{ 
        marginTop: '40px', 
        padding: '15px',
        backgroundColor: '#f0f8ff',
        borderRadius: '5px',
        border: '1px solid #4CAF50'
      }}>
        <h3 style={{ margin: '0' }}>Expected Annual Damage:</h3>
        <div style={{ 
          fontSize: '24px', 
          fontWeight: 'bold',
          color: '#4CAF50'
        }}>
          ${totalAnnualDamage.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
      </div>
      </div>
    </div>
  );
}

export default App;
