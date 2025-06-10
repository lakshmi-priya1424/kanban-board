import React from 'react';
import KanbanBoard,{KanbanProvider}from './KanbanBoard';


function App(props) {
  return (
    <div>
      <KanbanProvider>
      <h1 style={{textAlign:'center',color:'black'}}>Kanban Board</h1>
      <KanbanBoard/>
      </KanbanProvider>
    </div>
  );
}

export default App;