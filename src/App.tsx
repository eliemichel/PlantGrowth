import SplitterLayout from './third_party/react-splitter-layout';
import './third_party/react-splitter-layout/stylesheets/index.css';

import Viewport from './Viewport.tsx'
import NodeGraph from './NodeGraph.tsx'

import './App.css'

function App() {
  return (
    <SplitterLayout>
      <Viewport />
      <NodeGraph />
    </SplitterLayout>
  )
}

export default App
