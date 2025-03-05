import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const QueryTimePlot = ({ queryTimeData, draggedPointIndex, handleDragStart, getTangentLine }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
    <h3 style={{ textAlign: "center", marginBottom: "20px" }}>Query Time vs Number of Queries</h3>
    <LineChart
      className="query-time-chart"
      width={400}
      height={350}
      margin={{ top: 5, right: 50, left: 50, bottom: 25 }}
      data={queryTimeData}
    >
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis
        dataKey="queries"
        type="number"
        scale="log"
        domain={[1, 12]}
        label={{
          value: "Time spent by red team (months)",
          position: "bottom",
          offset: 20,
        }}
        ticks={[1,2,4,8]}
      />
      <YAxis
        domain={[0, 1000]}
        label={{
          value: "Average Number of Queries Executed",
          angle: -90,
          position: "center",
          dx: -35,
        }}
      />
      <Line
        type="linear"
        data={getTangentLine(queryTimeData)}
        dataKey="time"
        stroke="#82ca9d"
        strokeWidth={2}
        strokeDasharray="5 5"
        dot={false}
      />
      <Line
        type="monotoneX"
        dataKey="time"
        stroke="#82ca9d"
        name="Query Time"
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
                cursor: payload.fixed ? 'not-allowed' : 'grab',
                userSelect: 'none',
                WebkitUserSelect: 'none'
              }}
              onMouseDown={(e) => !payload.fixed && handleDragStart(e, index)}
            />
          );
        }}
      />
    </LineChart>
  </div>
);

const SuccessProbabilityPlot = ({ postMitigationData }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
    <h3 style={{ textAlign: "center", marginBottom: "20px" }}>Post-Mitigation Success Probability</h3>
    <LineChart
      width={400}
      height={350}
      margin={{ top: 5, right: 50, left: 50, bottom: 25 }}
      data={postMitigationData}
    >
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis
        dataKey="months"
        scale="log"
        domain={["auto", "auto"]}
        type="number"
        label={{
          value: "Months (log scale)",
          position: "bottom",
          offset: 20,
        }}
        tickFormatter={(value) => value.toFixed(1)}
      />
      <YAxis
        domain={[0, 1]}
        label={{
          value: "Success Probability",
          angle: -90,
          position: "center",
          dx: -35,
        }}
      />
      <Tooltip
        formatter={(value, name) => [value.toFixed(4), name]}
        labelFormatter={(value) => `${value.toFixed(1)} months of effort`}
      />
      <Legend
        layout="horizontal"
        align="center"
        verticalAlign="bottom"
        wrapperStyle={{
          paddingTop: "10px",
          bottom: -10,
        }}
      />
      <Line
        type="monotone"
        dataKey="successProbability"
        stroke="#2e8b57"
        name="Success probability conditional on effort"
        dot={false}
      />
    </LineChart>
  </div>
);

const ModelResults = ({ 
  queryTimeData, 
  draggedPointIndex, 
  handleDragStart, 
  getTangentLine,
  postMitigationData 
}) => {
  return (
    <div style={{
      flex: "1",
      display: "flex",
      flexDirection: "column",
      gap: "40px",
      padding: "30px",
    }}>
      <h2 style={{ textAlign: "center", margin: "0" }}>Model Results</h2>

      <QueryTimePlot 
        queryTimeData={queryTimeData}
        draggedPointIndex={draggedPointIndex}
        handleDragStart={handleDragStart}
        getTangentLine={getTangentLine}
      />

      <SuccessProbabilityPlot postMitigationData={postMitigationData} />
    </div>
  );
};

export default ModelResults;
