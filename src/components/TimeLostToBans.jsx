import React, { useState, useEffect, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
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

  // Find where the line intersects y=16 (if it does)
  const maxY = 16;
  let endTime = 45;
  let endBans = q2 + slope * (endTime - t2);

  // If line goes above maxY, find intersection point
  if (endBans > maxY) {
    // Solve: maxY = q2 + slope * (t - t2)
    // t = (maxY - q2)/slope + t2
    endTime = (maxY - q2)/slope + t2;
    endBans = maxY;
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

const TimeLostToBans = ({ onMouseUp, queriesPerMonth = 30, tooltipDescription = "This plot is estimated by experts. It shows the amount of time a novice misuse actor would likely need to spend to reacquire access to the AI assistant after being banned." }) => {
  // Refs for caching and DOM elements
  const pathCache = useRef({ points: null, path: null, length: null });
  const timeInterpolatorCache = useRef({ points: null, interpolator: null });
  const svgRef = useRef(null);
  // State for managing the data
  const [queryTimeData, setTimeBansData] = useState([]);
  const [draggedPointIndex, setDraggedPointIndex] = useState(null);

  // Initialize data
  useEffect(() => {
    const initialControlPoints = [
      { time: 0, queries: 0, fixed: true }, // Fixed starting point
      { time: 5, queries: 4 }, // First control point
      { time: 15, queries: 12 }, // Middle point
      { time: 45, queries: 16 }, // End point
    ];
    setTimeBansData(initialControlPoints);
  }, []);



  const [plotWidth, setPlotWidth] = useState(Math.min(300, window.innerWidth - 40));
  const plotHeight = 260;
  const plotMargin = { top: 10, right: 40, left: 0, bottom: 30 };

  useEffect(() => {
    const handleResize = () => {
      setPlotWidth(Math.min(300, window.innerWidth - 40));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle drag interactions
  useEffect(() => {
    const handleMouseMove = (event) => {
      if (draggedPointIndex === null) return;

      event.preventDefault();
      const svgElement = svgRef.current?.querySelector("svg");
      if (!svgElement) return;

      const svgRect = svgElement.getBoundingClientRect();
      const margin = plotMargin;
      const width = plotWidth - margin.left - margin.right;
      const height = plotHeight - margin.top - margin.bottom;

      const mouseX = event.clientX - svgRect.left - margin.left;
      const mouseY = event.clientY - svgRect.top - margin.top;

      const xScale = d3.scaleLinear().domain([0, 45]).range([0, width]);
      const maxBans = 16; // Fixed maximum number of bans
      const yScale = d3
        .scaleLinear()
        .domain([0, maxBans])
        .range([height, 0]);

      // If it's the first point, keep x at 0, otherwise constrain between 0 and 45
      const newtime = draggedPointIndex === 0 ? 0 : Math.max(0, Math.min(45, xScale.invert(mouseX)));
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

        // Constrain points to be monotonically increasing
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
    <div ref={svgRef}>
      <h4 style={{ fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', width: '100%' }}>
        <span>Time lost to bans</span>
        <div className="info-icon-tooltip" style={{ flexShrink: 0 }}>
          i
          <span className="tooltip">
            {tooltipDescription}
          </span>
        </div>
      </h4>
      <LineChart
        className="query-queries-chart"
        width={plotWidth}
        height={plotHeight}
        margin={plotMargin}
        data={queryTimeData}
      >
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis
          dataKey="time"
          type="number"
          domain={[0, 45]}
          ticks={[0, 15, 30, 45]}
          label={{
            value: "Time spent jailbreaking (days)",
            position: "bottom",
            offset: 0,
            style: { fontSize: 12 }
          }}
          tick={{ fontSize: 12 }}
        />
        <YAxis
          domain={[0, 16]}
          ticks={[0, 4, 8, 12, 16]}
          label={{
            value: "Time lost to bans (days)",
            angle: -90,
            position: "center",
            dx: -10,
            style: { fontSize: 12 }
          }}
          tick={{ fontSize: 12 }}
        />

        {/* Main curve */}
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

        {/* Extension line */}
        <Line
          type="linear"
          dataKey="queries"
          stroke="#3498db"
          // strokeDasharray="5 5"
          strokeWidth={2}
          dot={false}
          data={getTangentLineWithCache(queryTimeData, { current: pathCache })}
        />

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

// // External versions for use outside the component
// const getTimeLostGivenBans = (() => {
//   const pathCache = { points: null, path: null, length: null };
//   return (queryValue, points) => getBansForQueriesWithCache(queryValue, points, { current: pathCache });
// })();

const getTimeLostGivenBans = (() => {
  const pathCache = { points: null, path: null, length: null };
  return (points) => {
    if (!Array.isArray(points)) return [];

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
    const q2 = getBansAtTimeWithCache(t2, points, { current: pathCache });
    const q1 = getBansAtTimeWithCache(t1, points, { current: pathCache });
    const slope = (q2 - q1) / (t2 - t1);

    // Sample 1000 points, using path for interpolation within the curve
    // and tangent line for extrapolation beyond it
    const timeLost = [];
    for (let i = 0; i < 10000; i++) {
      if (i <= t2) {
        // Use monotone interpolation from the path
        let start = 0;
        let end = pathLength;
        let found = false;
        
        while (end - start > 0.1) {
          const mid = (start + end) / 2;
          const point = path.getPointAtLength(mid);
          
          if (Math.abs(point.x - i) < 0.1) {
            timeLost.push(point.y);
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
          timeLost.push(point.y);
        }
      } else {
        // Use tangent line for extrapolation
        const extrapolatedValue = q2 + slope * (i - t2);
        timeLost.push(extrapolatedValue);
      }
    }
    return timeLost;
  };
})();

// Create a version that returns an array of bans for queries 0-45
const getTimeLostToBansCurve = (() => {
  return (points) => {
    const numPoints = 1000;
    const bans = [];
    for (let i = 0; i < numPoints; i++) {
      const queryValue = (45 * i) / (numPoints - 1);
      bans.push(getTimeLostGivenBans(queryValue, points));
    }
    return bans;
  };
})();

// External version of getTangentLine with its own cache
const getTangentLine = (() => {
  const pathCache = { points: null, path: null, length: null };
  return (points) => getTangentLineWithCache(points, { current: pathCache });
})();

export { getTimeLostGivenBans, getTimeLostToBansCurve, getTangentLine };

export default TimeLostToBans;
