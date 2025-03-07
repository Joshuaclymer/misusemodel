import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getBansForQueries } from "./TimeLostToBans.jsx";

const QueriesVsTimeWithBans = ({
  timeToExecuteQueries, // timeToExecuteQueries
  banData, // from BansVsQueries
  timeLostData = [], // from TimeLostToBans
}) => {
  let timeToExecuteQueriesDisplayed = [];
  console.log("banCurveData", banData)
  console.log("timeLostData", timeLostData)
  console.log("timeToExecuteQueries", timeToExecuteQueries)
  
  // Collect points with adaptive sampling
  let lastValidIndex = 0;
  let lastAddedTime = -1;
  const minTimeGap = 5; // Minimum gap between points to reduce density
  
  for (let i = 0; i <= 45; i++) {
    const numBans = Math.floor(banData[i]);
    const totalTimeLostDueToBans = timeLostData[numBans];
    const execTime = timeToExecuteQueries[i] || 0;
    const time = execTime + totalTimeLostDueToBans;
    
    if (time < 45) {
      // Add point if it's the first point, last point, or if enough time has passed
      if (i === 0 || time - lastAddedTime >= minTimeGap || i === 45) {
        timeToExecuteQueriesDisplayed.push({
          time: time,
          queries: i,
        });
        lastAddedTime = time;
        lastValidIndex = i;
      }
    } else {
      break;
    }
  }
  
  // Calculate tangent line from last two points
  if (timeToExecuteQueriesDisplayed.length >= 2) {
    const lastPoint = timeToExecuteQueriesDisplayed[timeToExecuteQueriesDisplayed.length - 1];
    const prevPoint = timeToExecuteQueriesDisplayed[timeToExecuteQueriesDisplayed.length - 2];
    
    // Calculate slope using last two points
    const slope = (lastPoint.queries - prevPoint.queries) / (lastPoint.time - prevPoint.time);
    
    // Start from the last valid point and extrapolate until we hit bounds
    let currentTime = lastPoint.time;
    let currentQueries = lastPoint.queries;
    const step = 0.1;
    
    while (currentTime < 45 && currentQueries < 45) {
      const nextTime = currentTime + step;
      const nextQueries = lastPoint.queries + slope * (nextTime - lastPoint.time);
      
      if (nextTime > 45 || nextQueries > 45) break;
      
      timeToExecuteQueriesDisplayed.push({
        time: nextTime,
        queries: nextQueries,
      });
      
      currentTime = nextTime;
      currentQueries = nextQueries;
    }
  }
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
        Queries vs Time with Bans
      </h3>
      <LineChart
        data={timeToExecuteQueriesDisplayed}
        margin={{ top: 5, right: 50, left: 50, bottom: 25 }}
        width={400}
        height={350}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="time"
          type="number"
          domain={[0, 45]}
          ticks={[0, 15, 30, 45]}
          label={{ value: "Time (days)", position: "bottom" }}
        />
        <YAxis
          type="number"
          domain={[0, 45]}
          ticks={[0, 15, 30, 45]}
          label={{ value: "Queries", angle: -90, position: "left" }}
        />
        <Tooltip
          formatter={(value, name) => [
            value.toFixed(2),
            name === "queries" ? "Queries" : "Time (days)",
          ]}
        />
        <Line
          type="monotone"
          dataKey="queries"
          stroke="#8884d8"
          dot={false}
          strokeWidth={2}
        />
      </LineChart>
    </div>
  );
};

export default QueriesVsTimeWithBans;

