import React, { useState, useEffect, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import * as d3 from "d3";

const TimeVsQueries2 = ({ onMouseUp, queriesPerMonth = 30 }) => {
  // Cache for SVG path and interpolator
  const pathCache = useRef({
    points: null,
    path: null,
    length: null,
  });

  const getQueriesAtTime = (time, points) => {
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
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
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
  const getTangentLine = (points) => {
    if (points.length < 2) return [];

    const lastPoint = points[points.length - 1];
    const t2 = lastPoint.time;
    const t1 = Math.max(0, t2 - 5); // Get a point 5 days back

    const q2 = getQueriesAtTime(t2, points);
    const q1 = getQueriesAtTime(t1, points);

    // Calculate slope in linear space
    const slope = (q2 - q1) / (t2 - t1);

    // Calculate end point at max time (45 days)
    const endTime = Math.min(45, t2 + (45 - t2));
    const endQueries = Math.min(1000, q2 + slope * (endTime - t2));

    return [
      { time: t2, queries: q2 },
      { time: endTime, queries: endQueries },
    ];
  };

  // Cache for the time interpolator
  const timeInterpolatorCache = useRef({
    points: null,
    interpolator: null,
  });
  // Get all times for queries 0-1000 efficiently using interpolation
  const getTimeForQueries = (targetQueries, points) => {
    // Sort points by time
    const sortedPoints = [...points].sort((a, b) => a.time - b.time);
    const lastPoint = sortedPoints[sortedPoints.length - 1];

    // Get tangent line for extrapolation
    const t2 = lastPoint.time;
    const t1 = t2 - 5; // Get a point 5 days back

    const q2 = getQueriesAtTime(t2, points);
    const q1 = getQueriesAtTime(t1, points);

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
          queries.push(getQueriesAtTime(t, points));
        }

        timeInterpolatorCache.current = {
          points: points,
          interpolator: d3
            .scaleLinear()
            .domain(queries)
            .range(times)
            .clamp(true),
        };
      }

      return timeInterpolatorCache.current.interpolator(query);
    };

    // Handle array or single value
    if (typeof targetQueries === "number") {
      return getTimeForQuery(targetQueries);
    }

    return Array.from({ length: 1001 }, (_, i) => getTimeForQuery(i));
  };

  // State for managing the data
  const [queryTimeData, setTimeQueriesData] = useState([]);
  const [interpolatedData, setInterpolatedData] = useState([]);
  const [interpolatedTangent, setInterpolatedTangent] = useState([]);
  const [draggedPointIndex, setDraggedPointIndex] = useState(null);

  // Initialize data
  useEffect(() => {
    const initialControlPoints = [
      { time: 0, queries: 0, fixed: true },
      { time: 22.5, queries: 25 }, // Middle point slightly above the diagonal
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
      const time = mintime * (1 - t) + maxtime * t;
      points.push({
        time,
        queries: getQueriesAtTime(time, queryTimeData),
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
      const svgElement = document.querySelector(".time-queries-chart svg");
      if (!svgElement) return;

      const svgRect = svgElement.getBoundingClientRect();
      const margin = { left: 50, right: 50, top: 5, bottom: 25 };
      const width = 400 - margin.left - margin.right;
      const height = 350 - margin.top - margin.bottom;

      const mouseX = event.clientX - svgRect.left - margin.left;
      const mouseY = event.clientY - svgRect.top - margin.top;

      const xScale = d3.scaleLinear().domain([0, 45]).range([0, width]);
      const maxQueries = 45 * (queriesPerMonth / 30); // Convert days to months for query calculation
      const yScale = d3
        .scaleLinear()
        .domain([0, maxQueries])
        .range([height, 0]);

      const newtime = Math.max(0, Math.min(45, xScale.invert(mouseX)));
      const newqueries = Math.max(
        0,
        Math.min(maxQueries, yScale.invert(mouseY))
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
      setTimeQueriesData((prev) => {
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
        Queries vs Time
      </h3>
      <LineChart
        className="time-queries-chart"
        width={400}
        height={350}
        margin={{ top: 5, right: 50, left: 50, bottom: 25 }}
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
            value: "Time spent by red team (days)",
            position: "bottom",
            offset: 20,
          }}
        />
        <YAxis
          domain={[0, 45 * (queriesPerMonth / 30)]}
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

export default TimeVsQueries2;
