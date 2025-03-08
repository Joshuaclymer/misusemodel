import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { fitEffortCDF } from '../utils/curves.js';
import FormField from './FormField';
import FormContainer from './FormContainer';

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

  const [width, setWidth] = useState(Math.min(400, window.innerWidth - 40));
  useEffect(() => {
    const handleResize = () => {
      setWidth(Math.min(400, window.innerWidth - 40));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        backgroundColor: "#FBFBFB",
        borderRadius: "8px",
        // padding: "20px",
        // margin: "10px",
        padding: "clamp(10px, 2vw, 20px)",
        margin: "clamp(5px, 1vw, 10px)",
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)"
      }}
    >
      <FormContainer 
        title="Effort Distribution Parameters"
        tooltipDescription="The distribution below indicates the probability that a novice 'attempt' to develop a Pandemic Potential Pathogen will involve less than or equal to the amount of time indicated. An 'attempt' must involve at least two weeks of earnest effort. We assume this distribution is fixed and is unaffected by the deployment of the AI assistant."
      >
        {ANCHOR_MONTHS.slice(0, 3).map((month, index) => (
          <FormField
            key={month}
            label={`Effort at ${month} months (%):`}
            labelWidth="180px"
            width="100px"
            type="number"
            min={0}
            max={100}
            value={inputValues[`effortanch${index + 1}`]}
            onChange={(value) => handleInputChange(`effortanch${index + 1}`, value)}
            onSubmit={(value) => handleParameterChange(`effortanch${index + 1}`, value)}
          />
        ))}
      </FormContainer>

      <div style={{marginTop: "5px", marginBottom: "10px" }}>
        <LineChart
          width={width}
          height={350}
          margin={{ top: 0, right: 50, left: 50, bottom: 35 }}
          data={effortCDFData}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="months"
            scale="log"
            domain={["auto", "auto"]}
            type="number"
            label={{
              value: "Months spent on attempt (log scale)",
              position: "bottom",
              offset: 20,
              style: { fontSize: 12 }
            }}
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => (typeof value === 'number' ? value.toFixed(1) : value)}
          />
          <YAxis
            domain={[0, 1]}
            tickFormatter={(value) => Number(value.toPrecision(2))}
            label={{
              value: "Cumulative Probability of Attempt Effort",
              angle: -90,
              position: "center",
              dx: -35,
              style: { fontSize: 12 }
            }}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            formatter={(value, name) => [typeof value === 'number' ? value.toFixed(4) : value, name]}
            labelFormatter={(value) =>
              `${typeof value === 'number' ? value.toFixed(1) : value} months of effort`
            }
            contentStyle={{ fontSize: 12 }}
            itemStyle={{ fontSize: 12 }}
          />
          <Legend
            layout="horizontal"
            align="center"
            verticalAlign="bottom"
            wrapperStyle={{
              fontSize: 12,
              paddingTop: "15px",
              paddingBottom: "5px",
              bottom: 0
            }}
          />
          <Line
            type="monotone"
            dataKey="cumulativeProbability"
            stroke="#8884d8"
            name={<span style={{ fontSize: 12 }}>CDF(Effort of attempt)</span>}
            dot={false}
          />
        </LineChart>
      </div>
    </div>
  );
};

export default EffortCDF;
