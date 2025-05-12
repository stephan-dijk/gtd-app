window.utils = {
  API_URL: 'http://localhost:5000',

  themes: {
    dark: {
      body: 'bg-gray-900 text-white',
      container: 'bg-gray-800',
      input: 'bg-gray-700 text-white border-gray-600 rounded p-2 w-full',
      button: 'bg-blue-600 hover:bg-blue-700 text-white rounded p-2',
      tableHeader: 'bg-gray-700 text-white',
      tableRow: 'border-b border-gray-600 hover:bg-gray-700',
      selectedRow: 'bg-gray-600',
      modalBackdrop: 'bg-black bg-opacity-50',
      modal: 'bg-gray-800 text-white',
      actionButtons: {
        doNow: 'bg-green-600 hover:bg-green-700 text-white rounded p-2',
        delegate: 'bg-yellow-600 hover:bg-yellow-700 text-white rounded p-2',
        addTag: 'bg-purple-600 hover:bg-purple-700 text-white rounded p-2',
        delete: 'bg-red-600 hover:bg-red-700 text-white rounded p-2',
        addSubtask: 'bg-blue-600 hover:bg-blue-700 text-white rounded p-2',
        edit: 'bg-gray-600 hover:bg-gray-700 text-white rounded p-2',
        expand: 'bg-indigo-600 hover:bg-indigo-700 text-white rounded p-2',
        inactive: 'bg-gray-500 text-gray-300 rounded p-2 cursor-not-allowed'
      },
      kanban: {
        column: 'bg-gray-700 p-4 rounded-lg min-h-[200px]',
        card: 'bg-gray-600 p-2 mb-2 rounded-lg',
        cardHover: 'hover:bg-gray-500'
      },
      tooltip: 'bg-gray-700 text-white',
      loading: 'bg-green-600 text-white',
      error: 'bg-red-600 text-white p-2 rounded'
    },
    light: {
      body: 'bg-gray-100 text-black',
      container: 'bg-white',
      input: 'bg-gray-200 text-black border-gray-300 rounded p-2 w-full',
      button: 'bg-blue-500 hover:bg-blue-600 text-white rounded p-2',
      tableHeader: 'bg-gray-200 text-black',
      tableRow: 'border-b border-gray-300 hover:bg-gray-200',
      selectedRow: 'bg-gray-300',
      modalBackdrop: 'bg-black bg-opacity-50',
      modal: 'bg-white text-black',
      actionButtons: {
        doNow: 'bg-green-500 hover:bg-green-600 text-white rounded p-2',
        delegate: 'bg-yellow-500 hover:bg-yellow-600 text-white rounded p-2',
        addTag: 'bg-purple-500 hover:bg-purple-600 text-white rounded p-2',
        delete: 'bg-red-500 hover:bg-red-600 text-white rounded p-2',
        addSubtask: 'bg-blue-500 hover:bg-blue-600 text-white rounded p-2',
        edit: 'bg-gray-500 hover:bg-gray-600 text-white rounded p-2',
        expand: 'bg-indigo-500 hover:bg-indigo-600 text-white rounded p-2',
        inactive: 'bg-gray-400 text-gray-600 rounded p-2 cursor-not-allowed'
      },
      kanban: {
        column: 'bg-gray-200 p-4 rounded-lg min-h-[200px]',
        card: 'bg-white p-2 mb-2 rounded-lg shadow',
        cardHover: 'hover:bg-gray-100'
      },
      tooltip: 'bg-gray-200 text-black',
      loading: 'bg-green-500 text-white',
      error: 'bg-red-500 text-white p-2 rounded'
    }
  },

  handleInputChange: (inputRef, setValue, state, key, newValue) => {
    // Preserve cursor position for single-line inputs
    const input = inputRef.current;
    if (!input) {
      if (key) {
        setValue({ ...state, [key]: newValue });
      } else {
        setValue(newValue);
      }
      return;
    }

    const start = input.selectionStart;
    const end = input.selectionEnd;

    if (key) {
      setValue({ ...state, [key]: newValue });
    } else {
      setValue(newValue);
    }

    // Use setTimeout to ensure the DOM updates before resetting cursor
    setTimeout(() => {
      input.selectionStart = start;
      input.selectionEnd = end;
    }, 0);
  }
};