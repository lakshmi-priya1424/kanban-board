import { createContext, useEffect, useMemo, useReducer, useRef, useContext, useState } from 'react';
import './kanbanboard.css';

const KanbanContext = createContext();

const initialState = {
    todo: [],
    inProgress: [],
    done: []
};

function KanbanReducer(state, action) {
    switch (action.type) {
        case 'MOVE_CARD': {
            const { card, from, to, targetId } = action.payload;
            const newSource = state[from].filter(c => c.id !== card.id);
            let newTarget = [...state[to]];
            const alreadyInTarget = newTarget.find(c => c.id === card.id);
            if (alreadyInTarget) {
                newTarget = newTarget.filter(c => c.id !== card.id);
            }
            const targetIndex = newTarget.findIndex(c => c.id === targetId);
            if (targetIndex === -1 || from !== to) {
                newTarget.push(card);
            } else {
                newTarget.splice(targetIndex, 0, card);
            }
            return {
                ...state,
                [from]: from === to ? newTarget : newSource,
                [to]: newTarget,
            };
        }
        case 'ADD_TASK': {
            const newTask = {
                id: Date.now().toString(),
                text: action.payload.text
            };
            return {
                ...state,
                todo: [...state.todo, newTask]
            };
        }
        case 'DELETE_CARD': {
            const { cardId, from } = action.payload;
            return {
                ...state,
                [from]: state[from].filter(c => c.id !== cardId)
            };
        }
        case 'EDIT_CARD': {
            const { cardId, from, newText } = action.payload;
            return {
                ...state,
                [from]: state[from].map(card => card.id === cardId ?
                    { ...card, text: newText } : card)
            };
        }
        default:
            return state;
    }
}

function KanbanProvider({ children }) {
    const [state, dispatch] = useReducer(KanbanReducer, initialState);
    const [draggedCardId, setDraggedCardId] = useState(null);
    const [hoverTargetId, setHoverTargetId] = useState(null);

    const value = useMemo(() => ({
        state, dispatch, draggedCardId, setDraggedCardId, hoverTargetId, setHoverTargetId
    }), [state, draggedCardId, hoverTargetId]);

    return <KanbanContext.Provider value={value}>{children}</KanbanContext.Provider>;
}

function TaskInput() {
    const { dispatch } = useContext(KanbanContext);
    const [text, setText] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        dispatch({ type: 'ADD_TASK', payload: { text } });
        setText('');
    };
    return (
        <form className='task-form' onSubmit={handleSubmit}>
            <input type="text" value={text}
                onChange={e => setText(e.target.value)}
                placeholder='Add new task..' />
            <button type='submit'>ADD TASK</button>
        </form>
    );
}

function Card({ card, from }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedText, setEditedText] = useState(card.text);
    const cardRef = useRef();
    const inputRef = useRef(null);

    const { dispatch, draggedCardId, setDraggedCardId, hoverTargetId, setHoverTargetId } = useContext(KanbanContext);

    const handleDragStart = (e) => {
        if (!isEditing) {
            e.dataTransfer.setData('card', JSON.stringify({ card, from }));
            setDraggedCardId(card.id);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        if (draggedCardId !== card.id) {
            setHoverTargetId(card.id);
        }
    };

    const handleDragLeave = () => {
        if (hoverTargetId === card.id) {
            setHoverTargetId(null);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const data = JSON.parse(e.dataTransfer.getData('card'));
        dispatch({
            type: 'MOVE_CARD',
            payload: {
                card: data.card, from: data.from, to: from,
                targetId: card.id
            }
        });
        setHoverTargetId(null);
        setDraggedCardId(null);
    };

    const handleDoubleClick = () => {
        setIsEditing(true);
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const handleEditSubmit = () => {
        const trimmed = editedText.trim();
        if (trimmed && trimmed !== card.text) {
            dispatch({
                type: "EDIT_CARD",
                payload: { cardId: card.id, from, newText: trimmed }
            });
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            handleEditSubmit();
        } else if (e.key === "Escape") {
            setEditedText(card.text);
            setIsEditing(false);
        }
    };

    return (
        <div className={`card ${hoverTargetId === card.id ? "drop-indicator" : ""}`}
            ref={cardRef}
            draggable
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onDoubleClick={handleDoubleClick}>
            {isEditing ? (
                <input
                    ref={inputRef}
                    type="text"
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    onBlur={handleEditSubmit}
                    onKeyDown={handleKeyDown}
                    className='edit-input'
                />
            ) : (
                card.text
            )}
        </div>
    );
}

function Column({ title, columnKey, className }) {
    const { state, dispatch } = useContext(KanbanContext);
    const dropRef = useRef(null);

    useEffect(() => {
        const dropArea = dropRef.current;
        const handleDrop = (e) => {
            e.preventDefault();
            const data = JSON.parse(e.dataTransfer.getData('card'));
            dispatch({ type: 'MOVE_CARD', payload: { card: data.card, from: data.from, to: columnKey } });
        };
        const handleDragOver = e => e.preventDefault();
        dropArea.addEventListener('dragover', handleDragOver);
        dropArea.addEventListener('drop', handleDrop);
        return () => {
            dropArea.removeEventListener('dragover', handleDragOver);
            dropArea.removeEventListener('drop', handleDrop);
        };
    }, [dispatch, columnKey]);
    return (
        <div className={`column ${className}`} ref={dropRef}>
            <h2>{title}</h2>
            {state[columnKey].map(card => (
                <Card key={card.id} card={card} from={columnKey} />
            ))}
        </div>
    );
}

function TrashDropZone({ onCardDrop }) {
    const dropRef = useRef(null);

    useEffect(() => {
        const dropArea = dropRef.current;

        const handleDragOver = (e) => e.preventDefault();

        const handleDrop = (e) => {
            e.preventDefault();
            const data = JSON.parse(e.dataTransfer.getData('card'));
            onCardDrop({ card: data.card, from: data.from });
        };

        dropArea.addEventListener('dragover', handleDragOver);
        dropArea.addEventListener('drop', handleDrop);
        return () => {
            dropArea.removeEventListener('dragover', handleDragOver);
            dropArea.removeEventListener('drop', handleDrop);
        };

    }, [onCardDrop]);

    return (
        <div ref={dropRef} className='trash-drop-zone'>
            🗑️<br /><span>Trash Bin</span>
        </div>
    );
}

function KanbanBoard() {
    const [modalData, setModalData] = useState(null);
    const { dispatch } = useContext(KanbanContext);

    const handleConfirmDelete = () => {
        if (modalData) {
            dispatch({
                type: 'DELETE_CARD',
                payload: { cardId: modalData.card.id, from: modalData.from }
            });
            setModalData(null);
        }
    };

    return (
        <div className='board-container'>
            <TaskInput />
            <div className="board">
                <Column title="To Do" columnKey="todo" className="column-red" />
                <Column title="In Progress" columnKey="inProgress" className="column-yellow" />
                <Column title="Done" columnKey="done" className="column-green" />
                <TrashDropZone onCardDrop={setModalData} />
            </div>
            {modalData && (
                <div className='modal-overlay'>
                    <div className='modal'>
                        <p>
                            Are you sure you want to delete: <strong>"{modalData.card.text}"</strong>
                        </p>
                        <div className='modal-buttons'>
                            <button className='delete-btn' onClick={handleConfirmDelete}>Yes, Delete</button>
                            <button className='cancel-btn' onClick={() => setModalData(null)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export { KanbanProvider };
export default KanbanBoard;
