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
import { fitCurveWithFritschCarlson } from '../utils/curves.js';
import { maxTimeMonths } from '../App.js';

const ANCHOR_MONTHS = [3, 12, 36];

const generateData = (parameters) => {
  const points = [];
  const successPoints = [
    parameters.successanch1 / 100,
    parameters.successanch2 / 100,
    parameters.successanch3 / 100,
  ];

  for (let i = 0; i <= 100; i++) {
    const x = i / 100;
    // Use log scale from 0.1 months to 60 months (5 years)
    const time = Math.exp(
      Math.log(0.1) + x * (Math.log(maxTimeMonths) - Math.log(0.1))
    );

    // Calculate pre-mitigation probability using Fritsch-Carlson interpolation
    const preMitigationProb = fitCurveWithFritschCarlson(
      time,
      [0, ...successPoints],
      [Math.log(0.1), ...ANCHOR_MONTHS.map(x => Math.log(x))]
    );

    points.push({
      time,
      preMitigationProbability: preMitigationProb,
      postMitigationProbability: preMitigationProb,  // Will be updated if data is provided
    });
  }

  return points;
};

const ComparisonSuccessGivenEffort = ({ onChange, data, baselineData, readOnly, title = 'Success Probability Parameters', submittedValues }) => {
  const chartData = useMemo(() => {
    const baseData = generateData(submittedValues);
    
    // Create interpolator function
    const createInterpolator = (points) => {
      const sortedPoints = [...points].sort((a, b) => a.time - b.time);
      return (time) => {
        const point = sortedPoints.find(p => Math.abs(p.time - time) < 0.001);
        if (point) return point.successProbability;
        // Interpolate between closest points
        const next = sortedPoints.find(p => p.time > time);
        const prev = [...sortedPoints].reverse().find(p => p.time < time);
        if (!next || !prev) return prev ? prev.successProbability : next.successProbability;
        const ratio = (time - prev.time) / (next.time - prev.time);
        return prev.successProbability + ratio * (next.successProbability - prev.successProbability);
      };
    };

    // Get interpolators for both datasets if they exist
    const getPostMitigation = data && Array.isArray(data) && data.length > 0 ? createInterpolator(data) : null;
    const getBaseline = baselineData && Array.isArray(baselineData) && baselineData.length > 0 ? createInterpolator(baselineData) : null;

    return baseData.map(point => ({
      time: point.time,
      preMitigationProbability: point.preMitigationProbability,
      postMitigationProbability: getPostMitigation ? getPostMitigation(point.time) : point.postMitigationProbability,
      baselineProbability: getBaseline ? getBaseline(point.time) : null
    }));
  }, [data, baselineData, submittedValues]);

  return (
    <div style={{ width: "100%" }}>
      <LineChart
        width={400}
        height={350}
        margin={{ top: 5, right: 50, left: 50, bottom: 45 }}
        data={chartData}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="time"
          type="number"
          scale="log"
          domain={[0.1, maxTimeMonths]}
          ticks={[0.1, 1.0, 3.0, 12.0, maxTimeMonths]}
          tickFormatter={(value) => value.toFixed(1)}
          label={{
            value: "Time spent by attacker (months)",
            position: "center",
            dy: 25,
          }}
        />
        <YAxis
          domain={[0, (dataMax) => Math.max(0.2, dataMax)]}
          tickFormatter={(value) => Number(value.toPrecision(2))}
          label={{
            value: "Success Probability",
            angle: -90,
            position: "center",
            dx: -35,
          }}
        />
        <Tooltip />
        <Legend
          verticalAlign="bottom"
          align="center"
          wrapperStyle={{
            paddingTop: "20px"
          }}
        />
        <Line
          type="monotone"
          dataKey="baselineProbability"
          stroke="#2ecc71"
          name="Baseline Success Probability"
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="preMitigationProbability"
          stroke="#e74c3c"
          name="Pre-Mitigation Success Probability"
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="postMitigationProbability"
          stroke="#3498db"
          name="Post-Mitigation Success Probability"
          dot={false}
        />
      </LineChart>
    </div>
  );
};

export default ComparisonSuccessGivenEffort;
