import React, { useState, useEffect, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import * as d3 from "d3";

// Internal version with cache
const getBansAtTimeWithCache = (time, points, pathCache) => {
  // Update cache if points changed
  if (pathCache.current.points !== points) {
    const sortedPoints = [...points].sort((a, b) => a.time - b.time);

    // Create line generator with monotoneX interpolation
    const line = d3
      .line()
      .x((d) => d.time)
      .y((d) => d.queries)
      .curve(d3.curveMonotoneX);

    // Create SVG path
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", line(sortedPoints));

    // Update cache
    pathCache.current = {
      points: points,
      path: path,
      length: path.getTotalLength(),
    };
  }

  // Use cached path for lookup
  let start = 0;
  let end = pathCache.current.length;
  // Binary search to find point
  while (start <= end) {
    const mid = (start + end) / 2;
    const point = pathCache.current.path.getPointAtLength(mid);
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
  const point = pathCache.current.path.getPointAtLength(start);
  return point.y;
};

// Calculate tangent line at the last point
const getTangentLineWithCache = (points, pathCache) => {
  if (points.length < 2) return [];

  const lastPoint = points[points.length - 1];
  const t2 = lastPoint.time;
  const t1 = Math.max(0, t2 - 5); // Get a point 5 days back

  // Use the internal getBansAtTimeWithCache function
  const q2 = getBansAtTimeWithCache(t2, points, pathCache);
  const q1 = getBansAtTimeWithCache(t1, points, pathCache);

  // Calculate slope in linear space
  const slope = (q2 - q1) / (t2 - t1);

  // Find where the tangent line intersects y = 45 or x = 45
  const timeToYLimit = (45 - q2) / slope + t2;
  const queryAtXLimit = q2 + slope * (45 - t2);
  
  let endTime, endBans;
  if (timeToYLimit <= 45 && slope > 0) {
    // Line hits y = 45 first
    endTime = timeToYLimit;
    endBans = 45;
  } else {
    // Line hits x = 45 first (or slopes down)
    endTime = 45;
    endBans = Math.min(45, queryAtXLimit);
  }

  return [
    { time: t2, queries: q2 },
    { time: endTime, queries: endBans },
  ];
};

// Get all times for queries 0-1000 efficiently using interpolation
// Internal version with cache
const fitBanCurveWithCache = (
  targetBans,
  points,
  pathCache,
  timeInterpolatorCache
) => {
  // Sort points by time
  const sortedPoints = [...points].sort((a, b) => a.time - b.time);
  const lastPoint = sortedPoints[sortedPoints.length - 1];

  // Get tangent line for extrapolation
  const t2 = lastPoint.time;
  const t1 = t2 - 5; // Get a point 5 days back

  const q2 = getBansAtTimeWithCache(t2, points, pathCache);
  const q1 = getBansAtTimeWithCache(t1, points, pathCache);

  // Calculate slope in linear space
  const slope = (q2 - q1) / (t2 - t1);

  // Function to get time for a single query value
  const getTimeForQuery = (query) => {
    // If query is beyond the last point, use tangent line extrapolation
    if (query > q2) {
      const queryDiff = query - q2;
      const timeDiff = queryDiff / slope;
      return t2 + timeDiff;
    }

    // Otherwise use interpolation
    // Create interpolator if not cached or points changed
    if (
      !timeInterpolatorCache.current.points ||
      timeInterpolatorCache.current.points !== points
    ) {
      const numPoints = 1000;
      const times = [];
      const queries = [];

      // Generate evenly spaced points for time
      const minTime = sortedPoints[0].time;
      const maxTime = lastPoint.time;

      for (let i = 0; i < numPoints; i++) {
        const t = minTime + (maxTime - minTime) * (i / (numPoints - 1));
        times.push(t);
        queries.push(getBansAtTimeWithCache(t, points, pathCache));
      }

      timeInterpolatorCache.current = {
        points: points,
        interpolator: d3.scaleLinear().domain(queries).range(times).clamp(true),
      };
    }

    return timeInterpolatorCache.current.interpolator(query);
  };

  // Handle array or single value
  if (typeof targetBans === "number") {
    return getTimeForQuery(targetBans);
  }

  return Array.from({ length: 1001 }, (_, i) => getTimeForQuery(i));
};

const BansVsQueries = ({ onMouseUp, queriesPerMonth = 30, onChange }) => {
  // Refs for caching and DOM elements
  const pathCache = useRef({ points: null, path: null, length: null });
  const timeInterpolatorCache = useRef({ points: null, interpolator: null });
  const svgRef = useRef(null);
  // State for managing the data
  const [queryTimeData, setTimeBansData] = useState([]);
  const [interpolatedData, setInterpolatedData] = useState([]);
  const [interpolatedTangent, setInterpolatedTangent] = useState([]);
  const [draggedPointIndex, setDraggedPointIndex] = useState(null);

  // Initialize data
  useEffect(() => {
    const initialControlPoints = [
      { time: 0, queries: 0, fixed: true },
      { time: 20, queries: 19 }, // Middle point slightly above the diagonal
      { time: 45, queries: 30 }, // End at max x,y
    ];
    setTimeBansData(initialControlPoints);
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
      const time = mintime * (1 - t) + maxtime * t;
      points.push({
        time,
        queries: getBansAtTimeWithCache(time, queryTimeData, pathCache),
      });
    }

    setInterpolatedData(points);

    setInterpolatedTangent(getTangentLineWithCache(queryTimeData, pathCache));
    
    // Notify parent of changes
    if (onChange) {
      onChange(queryTimeData);
    }
  }, [queryTimeData, onChange]);

  // Handle drag interactions
  useEffect(() => {
    const handleMouseMove = (event) => {
      if (draggedPointIndex === null) return;

      event.preventDefault();
      const svgElement = svgRef.current?.querySelector("svg");
      if (!svgElement) return;

      const svgRect = svgElement.getBoundingClientRect();
      const margin = { left: 40, right: 30, top: 5, bottom: 20 };
      const width = 300 - margin.left - margin.right;
      const height = 250 - margin.top - margin.bottom;

      const mouseX = event.clientX - svgRect.left - margin.left;
      const mouseY = event.clientY - svgRect.top - margin.top;

      const xScale = d3.scaleLinear().domain([0, 45]).range([0, width]);
      const maxBans = 45 * (queriesPerMonth / 30); // Convert days to months for query calculation
      const yScale = d3
        .scaleLinear()
        .domain([0, maxBans])
        .range([height, 0]);

      const newtime = Math.max(0, Math.min(45, xScale.invert(mouseX)));
      const newqueries = Math.max(
        0,
        Math.min(maxBans, yScale.invert(mouseY))
      );

      // Round to 2 decimal places to avoid floating point issues
      const roundedtime = Math.round(newtime * 100) / 100;
      const roundedqueries = Math.round(newqueries * 100) / 100;

      const newData = [...queryTimeData];
      const currentPoint = newData[draggedPointIndex];

      // Only update if the change is significant enough and point is not fixed
      if (
        !currentPoint.fixed &&
        (Math.abs(currentPoint.time - newtime) > 0.5 ||
          Math.abs(currentPoint.queries - newqueries) > 0.5)
      ) {
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
        let constrainedBans = roundedqueries;
        if (prevPoint) {
          constrainedBans = Math.max(constrainedBans, prevPoint.queries);
        }
        if (nextPoint) {
          constrainedBans = Math.min(constrainedBans, nextPoint.queries);
        }

        newData[draggedPointIndex] = {
          time: constrainedTime,
          queries: constrainedBans,
        };
        setTimeBansData(newData);
      }
    };

    const handleMouseUp = () => {
      setDraggedPointIndex(null);
      // Sort points by x-value after drag ends
      setTimeBansData((prev) => {
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
      ref={svgRef}
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <h3 style={{ textAlign: "center", marginBottom: "20px" }}>
        Bans Vs Queries
      </h3>
      <LineChart
        className="query-queries-chart"
        width={300}
        height={250}
        margin={{ top: 5, right: 30, left: 40, bottom: 20 }}
        data={queryTimeData}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="time"
          type="number"
          scale="linear"
          domain={[0, 45]}
          ticks={[0, 5, 10, 15, 20, 25, 30, 35, 40, 45]}
          tickFormatter={(value) => value}
          label={{
            value: "Number of queries",
            position: "bottom",
            offset: 20,
          }}
        />
        <YAxis
          domain={[0, 45 * (queriesPerMonth / 30)]}
          label={{
            value: "Average number of bans",
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
          name="Original"
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
                onMouseDown={(e) => !payload.fixed && handleDragStart(e, index)}
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

// Function to get bans for a given query value
const getBansForQueriesWithCache = (queryValue, points, pathCache) => {
  // Sort points by x-value (time)
  const sortedPoints = [...points].sort((a, b) => a.time - b.time);
  
  // Find the two points that bracket our query value
  for (let i = 0; i < sortedPoints.length - 1; i++) {
    if (sortedPoints[i].time <= queryValue && sortedPoints[i + 1].time >= queryValue) {
      // Linear interpolation between the two points
      const p1 = sortedPoints[i];
      const p2 = sortedPoints[i + 1];
      const t = (queryValue - p1.time) / (p2.time - p1.time);
      return p1.queries + t * (p2.queries - p1.queries);
    }
  }
  
  // If we're beyond the last point, extrapolate using the last two points
  if (queryValue > sortedPoints[sortedPoints.length - 1].time) {
    const p1 = sortedPoints[sortedPoints.length - 2];
    const p2 = sortedPoints[sortedPoints.length - 1];
    const slope = (p2.queries - p1.queries) / (p2.time - p1.time);
    const dt = queryValue - p2.time;
    return p2.queries + slope * dt;
  }
  
  // If we're before the first point, extrapolate using the first two points
  const p1 = sortedPoints[0];
  const p2 = sortedPoints[1];
  const slope = (p2.queries - p1.queries) / (p2.time - p1.time);
  const dt = queryValue - p1.time;
  return p1.queries + slope * dt;
};

// External versions for use outside the component
const getBansForQueries = (() => {
  const pathCache = { points: null, path: null, length: null };
  return (points) => {
    if (!Array.isArray(points)) return [];

    // Sort points by time
    const sortedPoints = [...points].sort((a, b) => a.time - b.time);
    const lastPoint = sortedPoints[sortedPoints.length - 1];

    // Calculate tangent line for extrapolation using last two points
    const t2 = lastPoint.time;
    const t1 = t2 - 5; // Get a point 5 days back

    // Get points for tangent calculation
    const q2 = getBansAtTimeWithCache(t2, points, { current: pathCache });
    const q1 = getBansAtTimeWithCache(t1, points, { current: pathCache });

    // Calculate slope for extrapolation
    const slope = (q2 - q1) / (t2 - t1);

    // Create d3 line generator with monotone interpolation
    const line = d3.line()
      .x(d => d.time)
      .y(d => d.queries)
      .curve(d3.curveMonotoneX);

    // Create SVG path for interpolation
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", line(points));
    const pathLength = path.getTotalLength();

    // Sample 1000 points, using path for interpolation within the curve
    // and tangent line for extrapolation beyond it
    const bans = [];
    for (let i = 0; i < 10000; i++) {
      if (i <= t2) {
        // Use path interpolation for points within the curve
        let start = 0;
        let end = pathLength;
        let found = false;
        
        while (end - start > 0.1) {
          const mid = (start + end) / 2;
          const point = path.getPointAtLength(mid);
          
          if (Math.abs(point.x - i) < 0.1) {
            bans.push(point.y);
            found = true;
            break;
          }
          
          if (point.x < i) {
            start = mid;
          } else {
            end = mid;
          }
        }
        
        if (!found) {
          const point = path.getPointAtLength((start + end) / 2);
          bans.push(point.y);
        }
      } else {
        // Use tangent line extrapolation for points beyond the curve
        const extrapolatedValue = q2 + slope * (i - t2);

        bans.push(extrapolatedValue); // Clamp between 0 and 45
      }
    }
    return bans;
  };
})();

// Create a version that returns an array of bans for queries 0-45
const getBanCurve = (() => {
  return (points) => {
    const bans = [];
    for (let i = 0; i < 1800; i++) {
      const queryValue = i
      bans.push(getBansForQueries(queryValue, points));
    }
    return bans;
  };
})();

// External version of getTangentLine with its own cache
const getTangentLine = (() => {
  const pathCache = { points: null, path: null, length: null };
  return (points) => getTangentLineWithCache(points, { current: pathCache });
})();

export { getBansForQueries, getBanCurve};

export default BansVsQueries;
