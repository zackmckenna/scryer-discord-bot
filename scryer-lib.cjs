// CommonJS version of scryer-lib for compatibility with existing bot
const fs = require('fs');

/**
 * Get file path for channel event data
 */
function getFilePath(channelId) {
  return `./eventData_${channelId}.json`;
}

/**
 * Calculate next Monday's date in M/D format
 */
function getNextMonday() {
  const now = new Date();
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + ((1 - now.getDay() + 7) % 7));
  nextMonday.setHours(0, 0, 0, 0);

  const month = nextMonday.getMonth() + 1;
  const day = nextMonday.getDate();

  return `${month}/${day}`;
}

/**
 * Load event data from file
 */
function loadEventData(channelId, basePath = './') {
  const filePath = basePath + getFilePath(channelId);

  if (fs.existsSync(filePath)) {
    const rawData = fs.readFileSync(filePath);
    const parsedData = JSON.parse(rawData);
    return {
      participants: parsedData.participants || {},
      cardSet: parsedData.cardSet || 'TBD',
      messagesToUpdate: parsedData.messagesToUpdate || [],
      skipDelete: parsedData.skipDelete || false,
    };
  }

  return {
    participants: {},
    cardSet: 'TBD',
    messagesToUpdate: [],
    skipDelete: false,
  };
}

/**
 * Save event data to file
 */
function saveEventData(channelId, data, basePath = './') {
  const filePath = basePath + getFilePath(channelId);
  fs.writeFileSync(filePath, JSON.stringify(data));
}

/**
 * Clear participants data
 */
function clearParticipants(state) {
  if (state.skipDelete) {
    return {
      ...state,
      skipDelete: false,
    };
  }

  return {
    participants: {},
    cardSet: 'TBD',
    messagesToUpdate: [],
    skipDelete: false,
  };
}

/**
 * Handle join command
 */
function handleJoin(state, userId, displayName) {
  return {
    ...state,
    participants: {
      ...state.participants,
      [userId]: { plusOnes: 0, displayName }
    }
  };
}

/**
 * Handle leave command
 */
function handleLeave(state, userId) {
  const { [userId]: removed, ...remainingParticipants } = state.participants;
  return {
    ...state,
    participants: remainingParticipants
  };
}

/**
 * Handle add plus one command
 */
function handleAddPlusOne(state, userId) {
  if (!state.participants[userId]) {
    return { state, error: 'User must join first' };
  }

  return {
    state: {
      ...state,
      participants: {
        ...state.participants,
        [userId]: {
          ...state.participants[userId],
          plusOnes: state.participants[userId].plusOnes + 1
        }
      }
    }
  };
}

/**
 * Handle remove plus one command
 */
function handleRemovePlusOne(state, userId) {
  if (!state.participants[userId]) {
    return { state, error: 'User not in draft' };
  }

  if (state.participants[userId].plusOnes === 0) {
    return { state, error: 'No plus ones to remove' };
  }

  return {
    state: {
      ...state,
      participants: {
        ...state.participants,
        [userId]: {
          ...state.participants[userId],
          plusOnes: state.participants[userId].plusOnes - 1
        }
      }
    }
  };
}

/**
 * Handle set card set command
 */
function handleSetCardSet(state, cardSet) {
  return {
    ...state,
    cardSet
  };
}

module.exports = {
  getFilePath,
  getNextMonday,
  loadEventData,
  saveEventData,
  clearParticipants,
  handleJoin,
  handleLeave,
  handleAddPlusOne,
  handleRemovePlusOne,
  handleSetCardSet
};
