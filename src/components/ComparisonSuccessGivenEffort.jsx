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

const ComparisonSuccessGivenEffort = ({ onChange, postMitigationData, baselineData, readOnly, preMitigationData, tooltipDescription = "The distribution below shows the probability that a novice attempt to cause a large-scale harm succeeds given the amount of time spent on the attempt. The solid blue line shows the post-mitigation success probability, while the dashed lines show the baseline and pre-mitigation probabilities for comparison." }) => {
  console.log("preMitigationData", preMitigationData);
  console.log("postMitigationData", postMitigationData);
  console.log("baselineData", baselineData);

  const [width, setWidth] = useState(Math.min(600, window.innerWidth - 40));
  
  // Combine all datasets for the chart using preMitigationData time points as the base
  const chartData = useMemo(() => {
    if (!preMitigationData || preMitigationData.length === 0) {
      return [];
    }
    
    // Helper function to interpolate a value at a given time point
    const interpolateValue = (data, timePoint) => {
      if (!data || data.length === 0) return null;
      
      // Find the two closest points
      const sortedData = [...data].sort((a, b) => a.time - b.time);
      
      // If timePoint is before first point or after last point
      if (timePoint <= sortedData[0].time) return sortedData[0].successProbability;
      if (timePoint >= sortedData[sortedData.length - 1].time) return sortedData[sortedData.length - 1].successProbability;
      
      // Find the two points to interpolate between
      let lowerIndex = 0;
      for (let i = 0; i < sortedData.length - 1; i++) {
        if (sortedData[i].time <= timePoint && sortedData[i + 1].time >= timePoint) {
          lowerIndex = i;
          break;
        }
      }
      
      const lowerPoint = sortedData[lowerIndex];
      const upperPoint = sortedData[lowerIndex + 1];
      
      // Linear interpolation
      const ratio = (timePoint - lowerPoint.time) / (upperPoint.time - lowerPoint.time);
      return lowerPoint.successProbability + ratio * (upperPoint.successProbability - lowerPoint.successProbability);
    };
    
    // Use all time points from preMitigationData
    const sortedPreMitigationData = [...preMitigationData].sort((a, b) => a.time - b.time);
    
    // Create data points using preMitigationData time points
    return sortedPreMitigationData.map(point => {
      return {
        time: point.time,
        preMitigationProbability: point.successProbability,
        postMitigationProbability: interpolateValue(postMitigationData, point.time),
        baselineProbability: interpolateValue(baselineData, point.time)
      };
    });
  }, [postMitigationData, baselineData, preMitigationData]);

  useEffect(() => {
    const handleResize = () => {
      setWidth(Math.min(600, window.innerWidth - 40));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div style={{ 
        width: "min(600px, 100%)",
        marginTop: "clamp(3px, 0.5vw, 5px)",
        marginBottom: "clamp(5px, 1vw, 10px)"
      }}>
      <h4 style={{ 
        fontSize: 14, 
        fontWeight: 500, 
        display: 'flex', 
        alignItems: 'center', 
        marginTop: "35px",
        gap: '6px', 
        justifyContent: 'center', 
        width: '100%', 
        margin: '0 0 10px 0' 
      }}>
        <span>Post-mitigation success probability</span>
        <div className="info-icon-tooltip" style={{ flexShrink: 0 }}>
          i
          <span className="tooltip">
            {tooltipDescription}
          </span>
        </div>
      </h4>
      <LineChart
        width={width}
        height={425}
        margin={{ top: 5, right: 40, left: 40, bottom: 40 }}
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
            value: "Months spent on attempt (log scale)",
            position: "center",
            dy: 25,
          }}
        />
        <YAxis
          domain={[0, (dataMax) => Math.max(0.2, dataMax)]}
          tickFormatter={(value) => Number(value.toPrecision(2))}
          label={{
            value: "Success Probability of Attempt",
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
            paddingTop: "40px"
          }}
        />
        <Line
          type="monotone"
          dataKey="baselineProbability"
          stroke="#2ecc71"
          name="Baseline Success Probability"
          dot={false}
          strokeDasharray="3 3"
        />
        <Line
          type="monotone"
          dataKey="preMitigationProbability"
          stroke="#e74c3c"
          name="Pre-Mitigation Success Probability"
          dot={false}
          strokeDasharray="3 3"
        />
        <Line
          type="monotone"
          dataKey="postMitigationProbability"
          stroke="#3498db"
          strokeWidth={2}
          name="Post-Mitigation Success Probability"
          dot={false}
        />
      </LineChart>
    </div>
  );
};

export default ComparisonSuccessGivenEffort;
