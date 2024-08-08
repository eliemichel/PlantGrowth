import { ReactNode } from 'react';
import SplitterLayout from '../third_party/react-splitter-layout/index.tsx';
import '../third_party/react-splitter-layout/stylesheets/index.css';

import ViewportWithControls from './ViewportWithControls.tsx'
import NodeGraph from './NodeGraph.tsx'
import Actions from './Actions.tsx'
import Parameters from './Parameters.tsx'
import Inspector from './Inspector.tsx'
import SceneInfo from './SceneInfo.tsx'
import { TabItem, TabList } from './TabList.tsx'

import { NodeGraphProvider } from '../reducers/nodeGraphReducer.tsx'
import { SceneProvider } from '../reducers/sceneReducer.tsx'

import './App.css'

/**
 * A global state provider that regroups all state providers
 */
function StateProvider({ children }: { children: ReactNode }) {
  return (
    <SceneProvider>
      <NodeGraphProvider>
        { children }
      </NodeGraphProvider>
    </SceneProvider>
  );
}

/**
 * For now all panels show all possible tabs.
 */
function FullTabList({ initialTab }: { initialTab?: number }) {
  return (
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
    </TabList>
  )
}

export default function App() {
  console.log("Rebuild app");
  return (
    <StateProvider>
      <SplitterLayout percentage={true}>
        <ViewportWithControls />
        <SplitterLayout vertical={true} percentage={true} secondaryInitialSize={70}>
          <FullTabList />
          <FullTabList initialTab={1} />
        </SplitterLayout>
      </SplitterLayout>
    </StateProvider>
  )
}
