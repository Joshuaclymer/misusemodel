import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import * as d3 from 'd3';


// Cache for SVG path and interpolator
let pathCache = {
  points: null,
  path: null,
  length: null
};

const getQueriesAtTime = (time, points) => {
  // Update cache if points changed
  if (pathCache.points !== points) {
    const sortedPoints = [...points].sort((a, b) => a.time - b.time);
    
    // Create line generator with monotoneX interpolation
    const line = d3.line()
      .x(d => d.time)
      .y(d => d.queries)
      .curve(d3.curveMonotoneX);
      
    // Create SVG path
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", line(sortedPoints));
    
    // Update cache
    pathCache = {
      points: points,
      path: path,
      length: path.getTotalLength()
    };
  }
  
  // Use cached path for lookup
  let start = 0;
  let end = pathCache.length;
  // Binary search to find point
  while (start <= end) {
    const mid = (start + end) / 2;
    const point = pathCache.path.getPointAtLength(mid);
    const pointQuery = point.x;
    
    if (Math.abs(pointQuery - time) < 0.001) {
      return point.y;
    }
    
    if (pointQuery < time) {
      start = mid + 1;
    } else {
      end = mid - 1;
    }
  }
  
  // Get closest point
  const point = pathCache.path.getPointAtLength(start);
  return point.y;
};

// Calculate tangent line at the last point
const getTangentLine = (points) => {
  if (points.length < 2) return [];

  const lastPoint = points[points.length - 1];
  const t2 = lastPoint.time;
  const t1 = Math.max(0, t2 - 5); // Get a point 5 days back
  
  const q2 = getQueriesAtTime(t2, points);
  const q1 = getQueriesAtTime(t1, points);
  
  // Calculate slope in linear space
  const slope = (q2 - q1) / (t2 - t1);
  
  // Calculate how far we can extend the line before hitting either bound
  let endTime = t2;
  let endQueries = q2;
  
  // Incrementally extend the line until we hit either bound
  const step = 0.1;
  while (endTime < 45 && endQueries < 45) {
    const nextTime = endTime + step;
    const nextQueries = q2 + slope * (nextTime - t2);
    
    if (nextTime > 45 || nextQueries > 45) break;
    
    endTime = nextTime;
    endQueries = nextQueries;
  }
  
  return [
    { time: t2, queries: q2 },
    { time: endTime, queries: endQueries },
  ];
};

// Cache for the time interpolator
let timeInterpolatorCache = {
  points: null,
  interpolator: null
};

// Get all times for queries 0-10000 efficiently using interpolation
const fitQueriesCurve = (() => {
  const pathCache = { points: null, path: null, length: null };
  return (points) => {
    if (!Array.isArray(points)) return Array(10000).fill(0);

    // Sort points by time
    const sortedPoints = [...points].sort((a, b) => a.time - b.time);
    const lastPoint = sortedPoints[sortedPoints.length - 1];

    // Create d3 line generator with monotone interpolation
    const line = d3.line()
      .x(d => d.time)
      .y(d => d.queries)
      .curve(d3.curveMonotoneX);

    // Create SVG path for interpolation
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", line(points));
    const pathLength = path.getTotalLength();

    // Get points for tangent line calculation
    const t2 = lastPoint.time;
    const t1 = t2 - 5; // Get a point 5 days back

    // Calculate slope for tangent line
    const q2 = getQueriesAtTime(t2, points);
    const q1 = getQueriesAtTime(t1, points);
    const slope = (q2 - q1) / (t2 - t1);

    // Sample 10000 points, using path for interpolation within the curve
    // and tangent line for extrapolation beyond it
    const timeForQueries = [];
    for (let i = 0; i < 10000; i++) {
      if (i <= q2) {
        // Use monotone interpolation from the path
        if (!timeInterpolatorCache.points || timeInterpolatorCache.points !== points) {
          const numPoints = 1000;
          const times = [];
          const queries = [];

          // Generate evenly spaced points for time
          const minTime = sortedPoints[0].time;
          const maxTime = lastPoint.time;
          
          for (let j = 0; j < numPoints; j++) {
            const t = minTime + (maxTime - minTime) * (j / (numPoints - 1));
            times.push(t);
            queries.push(getQueriesAtTime(t, points));
          }

          timeInterpolatorCache = {
            points: points,
            interpolator: d3.scaleLinear()
              .domain(queries)
              .range(times)
              .clamp(true)
          };
        }
        timeForQueries.push(timeInterpolatorCache.interpolator(i));
      } else {
        // Use tangent line for extrapolation
        const queryDiff = i - q2;
        const timeDiff = queryDiff / slope;
        timeForQueries.push(t2 + timeDiff);
      }
    }
    return timeForQueries;
  };
})();

const TimeVsQueries = ({ onMouseUp, queriesPerMonth = 30 }) => {
  const [plotWidth, setPlotWidth] = useState(Math.min(300, window.innerWidth - 40));
  const plotMargin = { top: 10, right: 40, left: 0, bottom: 30 };
  const plotHeight = 260;
  const [queryTimeData, setTimeQueriesData] = useState([]);
  const [interpolatedData, setInterpolatedData] = useState([]);
  const [interpolatedTangent, setInterpolatedTangent] = useState([]);
  const [draggedPointIndex, setDraggedPointIndex] = useState(null);
  const [showDragHint, setShowDragHint] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      setPlotWidth(Math.min(plotWidth, window.innerWidth - 40));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);



  // Initialize data
  useEffect(() => {
    const initialControlPoints = [
      { time: 0, queries: 0, fixed: true },
      { time: 22.5, queries: 10 }, // Middle point slightly above the diagonal
      { time: 45, queries: 45 }, // End at max x,y
    ];
    setTimeQueriesData(initialControlPoints);
  }, []);

  // Generate interpolated points whenever queryTimeData changes
  useEffect(() => {
    if (queryTimeData.length < 2) return;
    
    // Generate 100 points for smooth curve
    const points = [];
    const mintime = queryTimeData[0].time;
    const maxtime = queryTimeData[queryTimeData.length - 1].time;
    
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      const time = mintime * (1-t) + maxtime * t;
      points.push({
        time,
        queries: getQueriesAtTime(time, queryTimeData)
      });
    }
    
    setInterpolatedData(points);

    setInterpolatedTangent(getTangentLine(queryTimeData));
  }, [queryTimeData]);



  // Handle drag interactions
  useEffect(() => {
    const handleMouseMove = (event) => {
      if (draggedPointIndex === null) return;

      event.preventDefault();
      const svgElement = document.querySelector(".query-queries-chart svg");
      if (!svgElement) return;

      const svgRect = svgElement.getBoundingClientRect();
      const width = plotWidth - plotMargin.left - plotMargin.right;
      const height = plotHeight - plotMargin.top - plotMargin.bottom;

      const mouseX = event.clientX - svgRect.left - plotMargin.left;
      const mouseY = event.clientY - svgRect.top - plotMargin.top;

      const xScale = d3.scaleLinear().domain([0, 45]).range([0, width]);
      const maxQueries = 45 * (queriesPerMonth / 30); // Convert days to months for query calculation
      const yScale = d3.scaleLinear().domain([0, maxQueries]).range([height, 0]);

      const newtime = Math.max(0, Math.min(45, xScale.invert(mouseX)));
      const newqueries = Math.max(0, Math.min(maxQueries, yScale.invert(mouseY)));

      // Round to 2 decimal places to avoid floating point issues
      const roundedtime = Math.round(newtime * 100) / 100;
      const roundedqueries = Math.round(newqueries * 100) / 100;

      const newData = [...queryTimeData];
      const currentPoint = newData[draggedPointIndex];

      // Only update if the change is significant enough and point is not fixed
      if (!currentPoint.fixed &&
          (Math.abs(currentPoint.time - newtime) > 0.5 ||
           Math.abs(currentPoint.queries - newqueries) > 0.5)) {

        // Ensure monotonicity in both time and queries
        const prevPoint = newData[draggedPointIndex - 1];
        const nextPoint = newData[draggedPointIndex + 1];
        
        // Constrain time to be between prev and next points with minimum log-space gap
        let constrainedTime = roundedtime;
        const MIN_LOG_GAP = 0.1; // Minimum gap in log space (about 10% difference)
        
        if (prevPoint) {
          // Ensure point is at least MIN_LOG_GAP away from previous point in log space
          const minLogTime = Math.log(prevPoint.time) + MIN_LOG_GAP;
          constrainedTime = Math.max(constrainedTime, Math.exp(minLogTime));
        }
        if (nextPoint) {
          // Ensure point is at least MIN_LOG_GAP away from next point in log space
          const maxLogTime = Math.log(nextPoint.time) - MIN_LOG_GAP;
          constrainedTime = Math.min(constrainedTime, Math.exp(maxLogTime));
        }
        
        // Constrain queries to be between prev and next points
        let constrainedQueries = roundedqueries;
        if (prevPoint) {
          constrainedQueries = Math.max(constrainedQueries, prevPoint.queries);
        }
        if (nextPoint) {
          constrainedQueries = Math.min(constrainedQueries, nextPoint.queries);
        }

        newData[draggedPointIndex] = {
          time: constrainedTime,
          queries: constrainedQueries,
        };
        setTimeQueriesData(newData);
      }
    };

    const handleMouseUp = () => {
      setDraggedPointIndex(null);
      // Sort points by x-value after drag ends
      setTimeQueriesData(prev => {
        const sorted = [...prev].sort((a, b) => a.time - b.time);
        onMouseUp?.(sorted);
        return sorted;
      });
    };

    if (draggedPointIndex !== null) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      // Prevent text selection while dragging
      document.body.style.userSelect = "none";
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
    };
  }, [draggedPointIndex, queryTimeData, onMouseUp]);

  const handleDragStart = (event, index) => {
    event.preventDefault();
    if (index === 1) { // Middle point
      setShowDragHint(false);
    }
    setDraggedPointIndex(index);
  };

  return (
      <div style={{ position: 'relative' }}>
        <h4 style={{ fontSize: 14, fontWeight: 500 }}>Queries executed vs effort</h4>
        {showDragHint && (
          <div 
            className="drag-me-hint"
            style={{
              left: '45%',
              top: '70%',
              transform: 'translate(-50%, -100%)',
              marginLeft: '30px',
              fontWeight: 'bold'
            }}
          >
            Drag me!
          </div>
        )}

      <LineChart
        className="query-queries-chart"
        width={plotWidth}
        height={plotHeight}
        margin={plotMargin}
        data={queryTimeData}
        textAnchor="start"
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="time"
          type="number"
          scale="linear"
          domain={[0, 45]}
          ticks={[0, 15, 30, 45]}
          tickFormatter={(value) => value}
          label={{
            value: "Time spent jailbreaking (days)",
            position: "bottom",
            offset: 0,
            style: { fontSize: 12 }
          }}
          tick={{ fontSize: 12 }}
        />
        <YAxis
          domain={[0, 45]}
          label={{
            value: "Queries executed",
            angle: -90,
            position: "center",
            dx: -10,
            style: { fontSize: 12 }
          }}
          tick={{ fontSize: 12 }}
        />

        {/* Tangent line */}
        <Line
          type="linear"
          data={getTangentLine(queryTimeData)}
          dataKey="queries"
          stroke="#3498db"
          strokeWidth={2}
          // Solid line
          dot={false}
        />
        {/* Original curve */}
        <Line
          type="monotoneX"
          dataKey="queries"
          stroke="#3498db"
          name={<span style={{ fontSize: 12 }}>Original</span>}
          strokeWidth={2}
          dot={(props) => {
            const { cx, cy, index, payload } = props;
            return (
              <circle
                cx={cx}
                cy={cy}
                r={draggedPointIndex === index ? 8 : 6}
                fill="#3498db"
                style={{
                  cursor: payload.fixed ? "not-allowed" : "grab",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                }}
                onMouseDown={(e) =>
                  !payload.fixed && handleDragStart(e, index)
                }
              />
            );
          }}
        />
        {/* Interpolated verification curve
        <Line
          data={interpolatedData}
          type="linear"
          dataKey="queries"
          stroke="#ff7f50"
          name="Interpolated"
          strokeWidth={1}
          dot={false}
        />
        
        {/* Interpolated tangent line */}
        {/* <Line
          data={interpolatedTangent}
          type="linear"
          dataKey="queries"
          stroke="#ff7f50"
          strokeWidth={1}
          // Solid line
          dot={false}
        /> */}
      </LineChart>
      </div>
  );
};

export { fitQueriesCurve, getQueriesAtTime };
export default TimeVsQueries;