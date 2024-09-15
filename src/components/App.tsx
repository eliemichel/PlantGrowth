import { useState } from 'react';
import SplitterLayout from '../third_party/react-splitter-layout/index.tsx';
import '../third_party/react-splitter-layout/stylesheets/index.css';

import { createInitialViewportState } from '../models/ViewportState.ts'
import { useStore } from '../store'

import ViewportWithControls from './ViewportWithControls.tsx'
import NodeGraph from './NodeGraph.tsx'
import Actions from './Actions.tsx'
import Parameters from './Parameters.tsx'
import Inspector from './Inspector.tsx'
import GrowthModelTab from './GrowthModelTab.tsx'
import ExpressionInfo from './ExpressionInfo.tsx'
import TransducerTab from './TransducerTab.tsx'
import Log from './Log.tsx'
import { TabItem, TabList } from './TabList.tsx'
import ExpressionProvider from './ExpressionProvider.tsx'

import './App.css'

/**
 * For now all panels show all possible tabs.
 */
function FullTabList({ initialTab }: { initialTab?: number }) {
  const activeExpr = useStore(store => store.selection.activeExpr);

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
        <TabItem label="Growth Model">
          <GrowthModelTab />
        </TabItem>
        <TabItem label="Expr Graph">
          <NodeGraph />
        </TabItem>
        <TabItem label="Expr Info">
          <ExpressionInfo />
        </TabItem>
        <TabItem label="Transducer">
          <TransducerTab />
        </TabItem>
        <TabItem label="Log">
          <Log />
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
