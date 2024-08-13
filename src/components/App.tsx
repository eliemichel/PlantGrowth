import { useState } from 'react';
import SplitterLayout from '../third_party/react-splitter-layout/index.tsx';
import '../third_party/react-splitter-layout/stylesheets/index.css';

import ViewportWithControls from './ViewportWithControls.tsx'
import NodeGraph from './NodeGraph.tsx'
import Actions from './Actions.tsx'
import Parameters from './Parameters.tsx'
import Inspector from './Inspector.tsx'
import SceneInfo from './SceneInfo.tsx'
import ExpressionInfo from './ExpressionInfo.tsx'
import { TabItem, TabList } from './TabList.tsx'

import { ExpressionProvider } from './ExpressionContext.tsx'

import { useScene } from '../reducers/sceneReducer.tsx'
import { createInitialViewportState } from '../models/ViewportState.tsx'

import './App.css'

/**
 * For now all panels show all possible tabs.
 */
function FullTabList({ initialTab }: { initialTab?: number }) {
  const activeExpr = useScene().selection.activeExpr;

  const activeExprPath = activeExpr !== null ? activeExpr.path : null;

  return (
    <ExpressionProvider path={activeExprPath}>
      <TabList initialTab={initialTab}>
        <TabItem label="Actions">
          <Actions />
        </TabItem>
        <TabItem label="Parameters">
          <Parameters />
        </TabItem>
        <TabItem label="Inspector">
          <Inspector />
        </TabItem>
        <TabItem label="Scene Info">
          <SceneInfo />
        </TabItem>
        <TabItem label="Node Graph">
          <NodeGraph />
        </TabItem>
        <TabItem label="Expr Info">
          <ExpressionInfo />
        </TabItem>
      </TabList>
    </ExpressionProvider>
  )
}

export default function App() {
  const [ viewportState, setViewportState ] = useState(createInitialViewportState());
  return (
    <SplitterLayout percentage={true}>
      <ViewportWithControls viewportState={viewportState} setViewportState={setViewportState} />
      <SplitterLayout vertical={true} percentage={true} secondaryInitialSize={70}>
        <FullTabList />
        <FullTabList initialTab={1} />
      </SplitterLayout>
    </SplitterLayout>
  )
}
