
import React, { useState, useMemo, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { generateCurvePoints } from '../utils/curves.js';
import { maxTimeMonths } from '../App.js';
import FormField from './FormField';
import FormContainer from './FormContainer';
import Card from './Card';

const ANCHOR_MONTHS = [3, 12, 36];



// const generateData = (parameters) => {
//   const points = [];
//   const successPoints = [
//     parameters.successanch1 / 100,
//     parameters.successanch2 / 100,
//     parameters.successanch3 / 100,
//   ];

//   for (let i = 0; i <= 100; i++) {
//     const x = i / 100;
//     // Use log scale from 0.1 months to 60 months (5 years)
//     const time = Math.exp(
//       Math.log(0.1) + x * (Math.log(maxTimeMonths) - Math.log(0.1))
//     );

//     // Calculate success probability using Fritsch-Carlson interpolation
//     const successProb = fitCurveWithFritschCarlson(
//       time,
//       [0, ...successPoints],
//       [Math.log(0.1), ...ANCHOR_MONTHS.map(x => Math.log(x))]
//     );

//     points.push({
//       time,
//       successProbability: successProb
//     });
//   }

//   console.log("points", points)
//   return points;
// };

const SuccessGivenEffort = ({ onChange, data, readOnly, title = 'Baseline Success Probability', hideLabels = false, initialValues, color = '#2ecc71', baselineValues, preMitigationValues }) => {
  const [width, setWidth] = useState(Math.min(400, window.innerWidth - 40));

  useEffect(() => {
    const handleResize = () => {
      setWidth(Math.min(400, window.innerWidth - 40));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Values shown in the input fields
  const [inputValues, setInputValues] = useState(initialValues || {
    successanch1: 0.1,
    successanch2: 3,
    successanch3: 10,
  });

  // Values used for the chart and calculations
  const [submittedValues, setSubmittedValues] = useState(initialValues || {
    successanch1: 0.1,
    successanch2: 3,
    successanch3: 10,
  });

  // Initialize data on mount
  useEffect(() => {
    if (!readOnly && onChange) {
      onChange(submittedValues);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInputChange = (key, value) => {
    setInputValues(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleParameterChange = (key, value) => {
    const newParams = {
      ...submittedValues,
      [key]: value
    };
    setSubmittedValues(newParams);
    if (onChange) onChange(newParams);
  };

  const chartData = useMemo(() => {
    if (data) return data;
    return generateCurvePoints(submittedValues);
  }, [data, submittedValues]);

  // Calculate max y-value from both curves
  const maxY = useMemo(() => {
    const baselineMax = baselineValues ? generateCurvePoints(baselineValues).reduce((max, point) => Math.max(max, point.successProbability), 0) : 0;
    const preMitigationMax = preMitigationValues ? generateCurvePoints(preMitigationValues).reduce((max, point) => Math.max(max, point.successProbability), 0) : 0;
    const currentMax = data ? data.reduce((max, point) => Math.max(max, point.successProbability), 0) : 0;
    return Math.max(0.2, baselineMax, preMitigationMax, currentMax);
  }, [baselineValues, preMitigationValues, data]);

  return (
    <div 
      style={{ 
        display: "flex", 
        flexDirection: "column", 
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FBFBFB",
        borderRadius: "8px",
        padding: "clamp(10px, 2vw, 20px)",
        margin: "clamp(5px, 1vw, 10px)",
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
      }}>
      {!readOnly && (
        <>
          <FormContainer title={title} style={{ fontSize: "12px", padding: "10px" }}>
            {ANCHOR_MONTHS.map((month, index) => (
              <FormField
                key={month}
                label={`Success at ${month} months (%):`}
                labelWidth="180px"
                width="100px"
                type="number"
                min={0}
                max={100}
                value={inputValues[`successanch${index + 1}`]}
                onChange={(value) => handleInputChange(`successanch${index + 1}`, value)}
                onSubmit={(value) => handleParameterChange(`successanch${index + 1}`, value)}
              />
            ))}
          </FormContainer>
        </>
      )}
      <div style={{ 
        width: "min(400px, 100%)", 
        marginTop: "clamp(3px, 0.5vw, 5px)", 
        marginBottom: "clamp(5px, 1vw, 10px)" 
      }}>
        <LineChart
          width={width}
          height={350}
          margin={{ top: 5, right: 50, left: 50, bottom: 35 }}
          data={chartData}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="time"
            scale="log"
            domain={[0.1, maxTimeMonths]}
            type="number"
            ticks={[0.1, 1, 3, 6, 12, 24, 36, maxTimeMonths]}
            label={{
              value: "Months (log scale)",
              position: "bottom",
              offset: 20,
              style: { fontSize: 12 }
            }}
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => value.toFixed(1)}
          />
          <YAxis
            domain={[0, maxY]}
            tickFormatter={(value) => Number(value.toPrecision(2))}
            label={{
              value: "Success Probability",
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
              paddingTop: "15px",
              paddingBottom: "5px",
              bottom: 0
            }}
            fontSize={12}
          />
          <Line
            type="monotone"
            dataKey="successProbability"
            stroke={color}
            name={<span style={{ fontSize: 12 }}>{title}</span>}
            dot={false}
          />
        </LineChart>
      </div>
    </div>
  );
};

export default SuccessGivenEffort;