import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import * as d3 from 'd3';

const getQueriesAtTime = (time, points) => {
  // Sort points by x value
  const sortedPoints = [...points].sort((a, b) => a.time - b.time);
  
  // Create line generator with monotoneX interpolation
  const line = d3.line()
    .x(d => Math.log(d.time))
    .y(d => d.queries)
    .curve(d3.curveMonotoneX);
    
  // Create SVG path
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", line(sortedPoints));
  
  // Get total length and use it to find point
  const length = path.getTotalLength();
  let start = 0;
  let end = length;
  const logQuery = Math.log(time);
  
  // Binary search to find point
  while (start <= end) {
    const mid = (start + end) / 2;
    const point = path.getPointAtLength(mid);
    const pointQuery = point.x;
    
    if (Math.abs(pointQuery - logQuery) < 0.001) {
      return point.y;
    }
    
    if (pointQuery < logQuery) {
      start = mid + 1;
    } else {
      end = mid - 1;
    }
  }
  
  // Get closest point
  const point = path.getPointAtLength(start);
  return point.y;
};

// Cache for the time interpolator
let timeInterpolatorCache = {
  points: null,
  interpolator: null
};

// Get all times for queries 0-1000 efficiently using interpolation
const getTimeForQueries = (targetQueries, points) => {
  // Check if we can use cached interpolator
  if (timeInterpolatorCache.points !== points) {
    // Sort points by time
    const sortedPoints = [...points].sort((a, b) => a.time - b.time);

    // Create a dense interpolation with 1000 points
    const numPoints = 1000;
    const times = [];
    const queries = [];

    // Generate evenly spaced points in log space for time
    const minLogTime = Math.log(sortedPoints[0].time);
    const maxLogTime = Math.log(sortedPoints[sortedPoints.length - 1].time);
    
    for (let i = 0; i < numPoints; i++) {
      const t = Math.exp(minLogTime + (maxLogTime - minLogTime) * (i / (numPoints - 1)));
      times.push(t);
      queries.push(getQueriesAtTime(t, points));
    }

    // Create and cache interpolator
    timeInterpolatorCache = {
      points: points,
      interpolator: d3.scaleLinear()
        .domain(queries)
        .range(times)
        .clamp(true)
    };
  }

  // If single query, return interpolated time
  if (typeof targetQueries === 'number') {
    return timeInterpolatorCache.interpolator(targetQueries);
  }

  // If array, return array of interpolated times
  return Array.from({length: 1001}, (_, i) => timeInterpolatorCache.interpolator(i));
};

const TimeVsQueries = ({ onMouseUp }) => {
  // State for managing the data
  const [queryTimeData, setTimeQueriesData] = useState([]);
  const [interpolatedData, setInterpolatedData] = useState([]);
  const [interpolatedTangent, setInterpolatedTangent] = useState([]);
  const [draggedPointIndex, setDraggedPointIndex] = useState(null);

  // Initialize data
  useEffect(() => {
    const initialControlPoints = [
      { time: 1, queries: 0, fixed: true }, // 1 day
      { time: 90, queries: 450 }, // 3 months
      { time: 270, queries: 750 }, // 9 months
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
      const time = Math.exp(Math.log(mintime) * (1-t) + Math.log(maxtime) * t);
      points.push({
        time,
        queries: getQueriesAtTime(time, queryTimeData)
      });
    }
    
    setInterpolatedData(points);

    setInterpolatedTangent(getTangentLine(queryTimeData));
  }, [queryTimeData]);

  // Calculate tangent line at the last point
  const getTangentLine = (points) => {
    if (points.length < 2) return [];

    const lastPoint = points[points.length - 1];
    const prevPoint = points[points.length - 2];

    // Use central difference with small h in log space for more accurate derivative
    const h = 0.001; // Small step size in log space
    const q = lastPoint.time;

    // Get points slightly before and after in log space
    const q1 = q * Math.exp(-h);
    const q2 = q * Math.exp(h);

    // Interpolate y values at these points using monotone interpolation
    const t = (Math.log(q) - Math.log(prevPoint.time)) /
              (Math.log(lastPoint.time) - Math.log(prevPoint.time));
    const dt = h / (Math.log(lastPoint.time) - Math.log(prevPoint.time));

    // Hermite interpolation for smooth derivative
    const t1 = t - dt;
    const t2 = t + dt;
    const y1 = prevPoint.queries * (1 - t1) + lastPoint.queries * t1;
    const y2 = prevPoint.queries * (1 - t2) + lastPoint.queries * t2;

    // Calculate slope using central difference
    const slope = (y2 - y1) / (2 * h); // This is dy/d(ln(x))

    // Find the maximum possible extension in both directions
    let maxLogExtension = Math.log(270 / lastPoint.time);
    let endqueries = lastPoint.queries + slope * maxLogExtension;

    // If we hit y bounds before x bounds, recalculate the extension
    if (endqueries > 1000) {
      maxLogExtension = (1000 - lastPoint.queries) / slope;
    } else if (endqueries < 0) {
      maxLogExtension = -lastPoint.queries / slope;
    }

    // Ensure extension is positive
    maxLogExtension = Math.max(0, maxLogExtension);

    return [
      lastPoint,
      {
        time: lastPoint.time * Math.exp(maxLogExtension),
        queries: lastPoint.queries + slope * maxLogExtension,
      },
    ];
  };

  // Handle drag interactions
  useEffect(() => {
    const handleMouseMove = (event) => {
      if (draggedPointIndex === null) return;

      event.preventDefault();
      const svgElement = document.querySelector(".query-queries-chart svg");
      if (!svgElement) return;

      const svgRect = svgElement.getBoundingClientRect();
      const margin = { left: 50, right: 50, top: 5, bottom: 25 };
      const width = 400 - margin.left - margin.right;
      const height = 350 - margin.top - margin.bottom;

      const mouseX = event.clientX - svgRect.left - margin.left;
      const mouseY = event.clientY - svgRect.top - margin.top;

      const xScale = d3.scaleLog().domain([1, 270]).range([0, width]);
      const yScale = d3.scaleLinear().domain([0, 1000]).range([height, 0]);

      const newtime = Math.max(1, Math.min(270, xScale.invert(mouseX)));
      const newqueries = Math.max(0, Math.min(1000, yScale.invert(mouseY)));

      // Round to 2 decimal places to avoid floating point issues
      const roundedtime = Math.round(newtime * 100) / 100;
      const roundedqueries = Math.round(newqueries * 100) / 100;

      const newData = [...queryTimeData];
      const currentPoint = newData[draggedPointIndex];

      // Only update if the change is significant enough and point is not fixed
      if (!currentPoint.fixed &&
          (Math.abs(currentPoint.time - newtime) > 0.5 ||
           Math.abs(currentPoint.queries - newqueries) > 0.5)) {
        newData[draggedPointIndex] = {
          time: roundedtime,
          queries: roundedqueries,
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
    setDraggedPointIndex(index);
  };

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <h3 style={{ textAlign: "center", marginBottom: "20px" }}>
        Query queries vs Number of time
      </h3>
      <LineChart
        className="query-queries-chart"
        width={400}
        height={350}
        margin={{ top: 5, right: 50, left: 50, bottom: 25 }}
        data={queryTimeData}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="time"
          type="number"
          scale="log"
          domain={[1, 270]}
          ticks={[1, 7, 30, 90, 180, 270]} // 1 day, 1 week, 1 month, 3 months, 6 months, 9 months
          tickFormatter={(value) => value}
          label={{
            value: "Time spent by red team (days)",
            position: "bottom",
            offset: 20,
          }}
        />
        <YAxis
          domain={[0, 1000]}
          label={{
            value: "Average Number of queries Executed",
            angle: -90,
            position: "center",
            dx: -35,
          }}
        />

        {/* Tangent line */}
        <Line
          type="linear"
          data={getTangentLine(queryTimeData)}
          dataKey="queries"
          stroke="#82ca9d"
          strokeWidth={2}
          // Solid line
          dot={false}
        />
        {/* Original curve */}
        <Line
          type="monotoneX"
          dataKey="queries"
          stroke="#82ca9d"
          name="Original"
          strokeWidth={2}
          dot={(props) => {
            const { cx, cy, index, payload } = props;
            return (
              <circle
                cx={cx}
                cy={cy}
                r={draggedPointIndex === index ? 8 : 6}
                fill="#82ca9d"
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

export { getTimeForQueries, getQueriesAtTime };
export default TimeVsQueries;