import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { fitEffortCDF } from '../utils/curves.js';

const ANCHOR_MONTHS = [3, 12, 36];



const generateCDFData = (parameters) => {
  const points = [];
  const panch1 = parameters.effortanch1;
  const panch2 = parameters.effortanch2;
  const panch3 = parameters.effortanch3;

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
      cumulativeProbability: fitEffortCDF(months, panch1, panch2, panch3)
    });
  }

  return points;
};

const EffortCDF = ({ onChange }) => {
  const [parameters, setParameters] = useState({
    effortanch1: 90,
    effortanch2: 95,
    effortanch3: 98
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
      [paramName]: value
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
          {ANCHOR_MONTHS.map((month, index) => (
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
