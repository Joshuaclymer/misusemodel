import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceDot, Label, ReferenceLine, ReferenceArea } from 'recharts';
import { maxTimeMonths } from '../App';

const SimulationPlot = ({ outputParams, maxTimeMonths, jailbreakTime, unacceptableRiskContribution, onJailbreakTimeChange }) => {
  const { mainlineRiskProjection, riskProjectionWithJailbreak } = outputParams;
  let unacceptableRiskThreshold = outputParams.baselineExpectedAnnualFatalities + unacceptableRiskContribution;
  console.log("unacceptableRiskThreshold", unacceptableRiskThreshold);
  
  // References for drag handling
  const chartRef = useRef(null);
  const isDraggingRef = useRef(false);
  const currentPositionRef = useRef(jailbreakTime);
  
  // Local state for rendering
  const [localJailbreakTime, setLocalJailbreakTime] = useState(jailbreakTime);
  
  // Update local state when prop changes (only when not dragging)
  useEffect(() => {
    if (!isDraggingRef.current) {
      setLocalJailbreakTime(jailbreakTime);
      currentPositionRef.current = jailbreakTime;
    }
  }, [jailbreakTime]);
  
  // Function to handle drag in the chart
  const handleDragInChart = useCallback((e) => {
    if (!chartRef.current || !isDraggingRef.current) return;
    
    // Get chart dimensions and coordinates
    const chartRect = chartRef.current.getBoundingClientRect();
    const { left, width } = chartRect;
    const { clientX } = e;
    
    // Calculate relative position in chart (0 to 1)
    const relativeX = Math.max(0, Math.min(1, (clientX - left) / width));
    
    // Convert to time value
    const minTime = 0.1;
    const maxTime = maxTimeMonths;
    const newTime = minTime + relativeX * (maxTime - minTime);
    const clampedTime = Math.min(maxTime, Math.max(minTime, newTime));
    
    // Update local state and ref
    currentPositionRef.current = clampedTime;
    setLocalJailbreakTime(clampedTime);
  }, [maxTimeMonths]);
  
  // Function to handle drag start
  const handleDragStart = useCallback((e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.addEventListener('mousemove', handleDragInChart);
    document.addEventListener('mouseup', handleDragEnd, { once: true });
  }, [handleDragInChart]);
  
  // Function to handle drag end
  const handleDragEnd = useCallback(() => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', handleDragInChart);
      
      // Find the nearest time point in mainlineRiskProjection
      if (mainlineRiskProjection && mainlineRiskProjection.length > 0) {
        const nearestPoint = mainlineRiskProjection.reduce((prev, curr) => {
          return Math.abs(curr.time - currentPositionRef.current) < Math.abs(prev.time - currentPositionRef.current) ? curr : prev;
        });
        
        // Snap to the nearest time point
        currentPositionRef.current = nearestPoint.time;
        setLocalJailbreakTime(nearestPoint.time);
      }
      
      // Update parent with snapped position
      onJailbreakTimeChange(currentPositionRef.current);
    }
  }, [handleDragInChart, onJailbreakTimeChange, mainlineRiskProjection]);
  

  
  // Create a jailbreak data point at the current jailbreak time
  const jailbreakPoint = useMemo(() => {
    if (!mainlineRiskProjection || mainlineRiskProjection.length === 0) return null;
    
    // Find nearest point to jailbreak time
    const nearestPoint = mainlineRiskProjection.reduce((prev, curr) => {
      return Math.abs(curr.time - localJailbreakTime) < Math.abs(prev.time - localJailbreakTime) ? curr : prev;
    });
    
    return {
      time: localJailbreakTime,
      risk: nearestPoint.risk
    };
  }, [mainlineRiskProjection, localJailbreakTime]);
  
  // Use the draggable jailbreak point instead of the first point from data
  const firstJailbreakPoint = jailbreakPoint;
  
  // Calculate the maximum y-value in the plot
  const maxYValue = useMemo(() => {
    let maxValue = 0;
    let mainlineMax = 0;
    let jailbreakMax = 0;
    
    // Check mainline data
    if (mainlineRiskProjection && mainlineRiskProjection.length > 0) {
      // Filter out any NaN or undefined values
      const validMainlinePoints = mainlineRiskProjection.filter(point => 
        point && point.risk !== undefined && !isNaN(point.risk));
      
      if (validMainlinePoints.length > 0) {
        mainlineMax = Math.max(...validMainlinePoints.map(point => point.risk));
        maxValue = Math.max(maxValue, mainlineMax);
      }
    }
    
    // Check jailbreak data
    if (riskProjectionWithJailbreak && riskProjectionWithJailbreak.length > 0) {
      // Filter out any NaN or undefined values
      const validJailbreakPoints = riskProjectionWithJailbreak.filter(point => 
        point && point.risk !== undefined && !isNaN(point.risk));
      
      if (validJailbreakPoints.length > 0) {
        jailbreakMax = Math.max(...validJailbreakPoints.map(point => point.risk));
        maxValue = Math.max(maxValue, jailbreakMax);
      }
    }
    
    // Also consider the unacceptable risk threshold
    maxValue = Math.max(maxValue, unacceptableRiskThreshold || 0);
    
    // Add a fallback minimum value if everything else is zero or invalid
    if (maxValue <= 0) {
      maxValue = 10; // Reasonable default
    }
    
    console.log("Max value calculation:", {
      mainlineMax,
      jailbreakMax,
      threshold: unacceptableRiskThreshold,
      finalMaxValue: maxValue
    });
    
    // Apply the chart bounds from memory (max y = 45)
    return maxValue
  }, [mainlineRiskProjection, riskProjectionWithJailbreak, unacceptableRiskThreshold]);


  console.log("maxYValue", maxYValue);
  
  // Extract the interpolation points and calculate the intersection point
  const { intersectionPoint, lastPointBeforeThreshold, firstPointAfterThreshold } = useMemo(() => {
    if (!riskProjectionWithJailbreak || riskProjectionWithJailbreak.length === 0 || !unacceptableRiskThreshold) {
      return { intersectionPoint: null, lastPointBeforeThreshold: null, firstPointAfterThreshold: null };
    }
    
    // Find the first point that exceeds the threshold and the last point before the threshold is exceeded
    let firstPointAfterThreshold = null;
    let lastPointBeforeThreshold = null;
    for (let i = 0; i < riskProjectionWithJailbreak.length; i++) {
      const point = riskProjectionWithJailbreak[i];
      
      // Skip points with undefined risk values
      if (point.risk === undefined || point.risk === null) {
        continue;
      }
      
      if (point.risk >= unacceptableRiskThreshold) {
        lastPointBeforeThreshold = riskProjectionWithJailbreak[i - 1];
        firstPointAfterThreshold = point;
        break;
      }
    }
    // console.log(firstPointAfterThreshold, lastPointBeforeThreshold);

    let intersectionPoint = null;
    if (firstPointAfterThreshold && lastPointBeforeThreshold) {
      // Linear interpolation to find the exact intersection point
      const slope = (firstPointAfterThreshold.risk - lastPointBeforeThreshold.risk) / 
                    (firstPointAfterThreshold.time - lastPointBeforeThreshold.time);
      const deltaY = unacceptableRiskThreshold - lastPointBeforeThreshold.risk;
      const deltaX = deltaY / slope;
      const intersectionTime = lastPointBeforeThreshold.time + deltaX;
      
      intersectionPoint = {
        time: intersectionTime,
        risk: unacceptableRiskThreshold
      };
    }

    return { 
      intersectionPoint, 
      lastPointBeforeThreshold, 
      firstPointAfterThreshold 
    };
  }, [riskProjectionWithJailbreak, unacceptableRiskThreshold]);
  
  // Combine data for both lines
  const combinedData = useMemo(() => {
    // Make sure both datasets exist
    if (!mainlineRiskProjection || !riskProjectionWithJailbreak) {
      return mainlineRiskProjection || [];
    }
    
    // Create a map of time to data points
    const dataMap = new Map();
    
    // Add mainline data
    mainlineRiskProjection.forEach(point => {
      dataMap.set(point.time, { 
        time: point.time, 
        mainlineRisk: point.risk,
        jailbreakRisk: null
      });
    });
    
    // Add jailbreak data
    riskProjectionWithJailbreak.forEach(point => {
      if (dataMap.has(point.time)) {
        // Update existing entry
        const existing = dataMap.get(point.time);
        existing.jailbreakRisk = point.risk;
      } else {
        // Create new entry
        dataMap.set(point.time, { 
          time: point.time, 
          mainlineRisk: null,
          jailbreakRisk: point.risk
        });
      }
    });
    
    // Convert map to array and sort by time
    return Array.from(dataMap.values()).sort((a, b) => a.time - b.time);
  }, [mainlineRiskProjection, riskProjectionWithJailbreak]);
  


  return (
    <div style={{ 
      width: '100%', 
      height: 500, 
      paddingTop: "20px", 
      position: 'relative',
      userSelect: 'none', /* Prevent text selection */
      WebkitUserSelect: 'none',
      MozUserSelect: 'none',
      msUserSelect: 'none'
    }}>
      <ResponsiveContainer width="100%" height="100%" className="chart-container" ref={chartRef}>
        <LineChart
          data={combinedData}
          margin={{ top: 40, right: 60, left: 60, bottom: 20 }}
          overflow="visible"
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="time"
            label={{ value: 'Time after deployment (months)', position: 'insideBottom', dy: 30 }}
            domain={[0.1, maxTimeMonths]}
            // scale="log"
            type="number"
            allowDataOverflow={true}
            // ticks={[0.1, 1, 5, 10, 20, 40, 60]}
            tickFormatter={(value) => (typeof value === 'number' ? value.toFixed(0) : value)}
            tick={{ fontSize: 15}}
          />
          <YAxis
            domain={[0, Math.max(maxYValue * 1.1)]}
            tickFormatter={(value) => {
              if (value === 0) return '0';
              const magnitude = Math.floor(Math.log10(Math.abs(value)));
              const scale = Math.pow(10, -magnitude + 1);
              return (Math.round(value * scale) / scale).toString();
            }}
            tick={{ fontSize: 15 }}
            label={{
              value: 'Risk (annualized expected fatalities)',
              angle: -90,
              position: 'insideLeft',
              dx: -30,
              style: { textAnchor: 'middle' }
            }}
          />
          <Tooltip 
            formatter={(value, name) => {
              if (name === 'Annualized risk post deployment (no jailbreak)') return ['Risk: ' + value.toFixed(3), name];
              if (name === 'Annualized risk post deployment (after universal jailbreak method becomes available)') return ['Risk: ' + value.toFixed(3), name];
              return [value, name];
            }}
            labelFormatter={(label) => `Time: ${parseFloat(label).toFixed(2)} months`}
            isAnimationActive={false}
            position={{ x: 'auto', y: 'auto' }}
          />
          <Legend 
            layout="horizontal"
            verticalAlign="bottom"
            align="center"
            wrapperStyle={{
              paddingTop: 60,
              paddingBottom: 20
            //   marginTop: 40,
            //   paddingBottom: 20
            }}
            iconSize={10}
            itemStyle={{ padding: '0 10px' }}
          />
          
          {/* Horizontal line for unacceptable risk threshold */}
          {/* Yellow highlighted area between jailbreak emergence and risk threshold intersection */}
          {firstJailbreakPoint && intersectionPoint && (
            <ReferenceArea 
              x1={firstJailbreakPoint.time} 
              x2={intersectionPoint.time}
              y1={0}
              y2={maxYValue * 1.1} /* Using a high fixed value to ensure it covers the graph */
              fill="#F3FFFB"
              fillOpacity={0.3}
              stroke="#6CD5B2"
              strokeOpacity={1}
              strokeDasharray="3 3"
              ifOverflow="visible"
            >
            </ReferenceArea>
          )}
          
          {/* Interactive vertical line for jailbreak start */}
          <ReferenceLine
            x={localJailbreakTime}
            stroke="#197052"
            strokeWidth={2}
            strokeDasharray="5 5"
            ifOverflow="visible"
            style={{ cursor: 'ew-resize' }}
          >
            <Label
              value="(Drag me 👋)"
              position="insideTopLeft"
              fill="#197052"
              fontSize={16}
              fontStyle="italic"
              fontWeight="normal"
              offset={5}
            />
          </ReferenceLine>
          
          {/* Invisible wider reference area for easier drag handling */}
          <ReferenceArea
            x1={Math.max(0.1, localJailbreakTime - 3)}
            x2={Math.min(maxTimeMonths, localJailbreakTime + 3)}
            fill="transparent"
            stroke="none"
            style={{ cursor: 'ew-resize' }}
            onMouseDown={handleDragStart}
          />
          
          <ReferenceLine 
            y={unacceptableRiskThreshold} 
            stroke="#ff0000" 
            strokeWidth={2}
            strokeDasharray="3 3"
          >
            <Label 
              offset={15}
              fill="#ff0000"
              fontSize={16}
              fontWeight="normal"
              position="insideBottomLeft"
              value="Unacceptable risk threshold"
            />
          </ReferenceLine>
          <Line
            type="monotone"
            dataKey="mainlineRisk"
            name="Risk post deployment (w/o jailbreak)"
            stroke="#8884d8"
            dot={false}
            strokeWidth={2}
            connectNulls={true}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="jailbreakRisk"
            name="Risk post deployment (w/ jailbreak)"
            stroke="#ff7300"
            strokeDasharray="5 5"
            dot={false}
            strokeWidth={2}
            connectNulls={true}
            isAnimationActive={false}
          />
          
          {/* First dot with label */}
          {firstJailbreakPoint && (
            <ReferenceDot
              x={firstJailbreakPoint.time}
              y={firstJailbreakPoint.risk}
              r={6}
              fill="#ff7300"
              stroke="none"
            >
              <Label
                value="Universal jailbreak emerges"
                position="insideBottomRight"
                offset={15}
                fill="#ff7300"
                fontSize={16}
                fontWeight="normal"
              />
            </ReferenceDot>
          )}
          
          {firstJailbreakPoint && intersectionPoint && (
            <ReferenceDot
              x={(intersectionPoint.time)} /* Centered between start and end of window */
              y={maxYValue * 1.1}
              r={0} /* Invisible dot */
              fill="transparent"
              stroke="none"
            >
              <Label
                value={`Window to respond and correct deployment: ${(intersectionPoint.time - firstJailbreakPoint.time).toFixed(2)} months`}
                position="top"
                offset={15}
                fill="#197052"
                fontSize={16}
                fontWeight="normal"
                style={{ 
                  backgroundColor: "#ffffcc", 
                  padding: "3px 6px", 
                  border: "1px solid #ffcc00", 
                  borderRadius: "4px", 
                  textAnchor: "middle",
                  overflow: "visible"
                }}
              />
            </ReferenceDot>
          )}
          
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SimulationPlot;



          