import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { fitEffortCDF } from '../utils/curves.js';

const ANCHOR_MONTHS = [3, 12, 36, 60];



export const generateCDFData = (parameters) => {
  // Handle array input by taking first element
  const params = Array.isArray(parameters) ? parameters[0] : parameters;
  if (!params || typeof params !== 'object') {
    console.error('Invalid parameters passed to generateCDFData:', parameters);
    return [];
  }

  const points = [];
  const panch1 = params.effortanch1;
  const panch2 = params.effortanch2;
  const panch3 = params.effortanch3;
  const panch4 = params.effortanch4;

  if (panch1 === undefined || panch2 === undefined || panch3 === undefined) {
    console.error('Missing required anchor points:', params);
    return [];
  }

  // Validate parameters
  if (
    panch1 >= panch2 ||
    panch2 >= panch3 ||
    panch1 < 0 ||
    panch2 < 0 ||
    panch3 < 0 ||
    panch3 > 100
  ) {
    return [];
  }

  // Generate points
  for (let i = 0; i <= 100; i++) {
    const x = i / 100;
    // Use log scale from 0.1 months to 60 months (5 years)
    const months = Math.exp(
      Math.log(0.1) + x * (Math.log(60) - Math.log(0.1))
    );

    points.push({
      months,
      cumulativeProbability: fitEffortCDF(months, panch1, panch2, panch3, panch4)
    });
  }

  return points;
};

const EffortCDF = ({ onChange }) => {
  const [parameters, setParameters] = useState({
    effortanch1: 90,
    effortanch2: 95,
    effortanch3: 98,
    effortanch4: 100
  });

  const effortCDFData = useMemo(
    () => generateCDFData(parameters),
    [parameters]
  );

  useEffect(() => {
    // Initial update
    onChange?.(parameters);
  }, []); // Only run once on mount

  const [inputValues, setInputValues] = useState({
    effortanch1: parameters.effortanch1,
    effortanch2: parameters.effortanch2,
    effortanch3: parameters.effortanch3
  });

  const handleInputChange = (paramName, value) => {
    setInputValues(prev => ({
      ...prev,
      [paramName]: value
    }));
  };

  const handleParameterChange = (paramName, value) => {
    const newParameters = {
      ...parameters,
      [paramName]: value,
      // Always keep effortanch4 at 100
      effortanch4: 100
    };
    setParameters(newParameters);
    onChange?.(newParameters);
  };

  return (
    <div
      style={{
        width: "400px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "30px"
      }}
    >
      <div style={{ width: "100%" }}>
        <h4 style={{ textAlign: "center", marginBottom: "20px" }}>Effort Distribution Parameters</h4>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            marginBottom: "20px",
          }}
        >
          {ANCHOR_MONTHS.slice(0, 3).map((month, index) => (
            <div key={month}>
              <label>Effort at {month} months (%):</label>
              <input
                type="number"
                value={inputValues[`effortanch${index + 1}`]}
                onChange={(e) => {
                  const value = e.target.value === '' ? '' : parseFloat(e.target.value);
                  handleInputChange(`effortanch${index + 1}`, value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                    handleParameterChange(`effortanch${index + 1}`, value);
                  }
                }}
                style={{ width: "80px", marginLeft: "10px" }}
              />
            </div>
          ))}
        </div>
      </div>

      <div style={{ width: "100%" }}>
        <h3 style={{ textAlign: "center", marginBottom: "20px" }}>
          CDF(Effort of attempt)
        </h3>
        <LineChart
          width={400}
          height={350}
          margin={{ top: 5, right: 50, left: 50, bottom: 25 }}
          data={effortCDFData}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="months"
            scale="log"
            domain={["auto", "auto"]}
            type="number"
            label={{
              value: "Months (log scale)",
              position: "bottom",
              offset: 20,
            }}
            tickFormatter={(value) => (typeof value === 'number' ? value.toFixed(1) : value)}
          />
          <YAxis
            domain={[0, 1]}
            label={{
              value: "Cumulative Probability",
              angle: -90,
              position: "center",
              dx: -35,
            }}
          />
          <Tooltip
            formatter={(value, name) => [typeof value === 'number' ? value.toFixed(4) : value, name]}
            labelFormatter={(value) =>
              `${typeof value === 'number' ? value.toFixed(1) : value} months of effort`
            }
          />
          <Legend
            layout="horizontal"
            align="center"
            verticalAlign="bottom"
            wrapperStyle={{
              paddingTop: "10px",
              bottom: -10,
            }}
          />
          <Line
            type="monotone"
            dataKey="cumulativeProbability"
            stroke="#8884d8"
            name="CDF(Effort of attempt)"
            dot={false}
          />
        </LineChart>
      </div>
    </div>
  );
};

export default EffortCDF;
