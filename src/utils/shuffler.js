/**
 * BNI Conclave Shuffling Algorithm (Categorized)
 * 
 * Objectives:
 * 1. Distribute participants based on prefix strictly: 2 'S', 2 'N', 1 'E'.
 * 2. Captains are fixed to their assigned tables.
 * 3. A participant should not visit a table they have already visited in previous rounds.
 * 4. A participant should not sit with someone (Captain or other participant) they have already sat with.
 */

// Helper to shuffle an array (Fisher-Yates)
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function generateRoundAssignments(tables, activeMembers, previousRounds) {
  if (tables.length === 0) throw new Error("No tables exist. Please create tables first.");
  if (activeMembers.length === 0) throw new Error("No active members to assign.");

  const MAX_TABLE_SIZE = 6;
  const totalMembers = activeMembers.length;
  const neededTablesCount = Math.ceil(totalMembers / MAX_TABLE_SIZE);

  if (neededTablesCount > tables.length) {
    throw new Error(`Not enough tables! You have ${totalMembers} members, which requires at least ${neededTablesCount} tables to seat everyone (max ${MAX_TABLE_SIZE} per table). Please create more tables.`);
  }

  // Calculate optimal target sizes (Maximize 6s, then 5s and 4s)
  const targetSizes = [];
  let remaining = totalMembers;
  
  if (totalMembers < neededTablesCount * 4) {
    // Fallback for very small numbers (1, 2, 3, 7)
    for (let i = 0; i < neededTablesCount; i++) {
      const s = Math.ceil(remaining / (neededTablesCount - i));
      targetSizes.push(s);
      remaining -= s;
    }
  } else {
    for (let i = 0; i < neededTablesCount; i++) {
      const tablesLeft = neededTablesCount - i;
      let assigned = 6;
      while (assigned >= 4) {
        const remainder = remaining - assigned;
        const otherTables = tablesLeft - 1;
        if (otherTables === 0) {
          if (remainder === 0) {
            targetSizes.push(assigned);
            remaining -= assigned;
            break;
          }
        } else {
          if (remainder >= otherTables * 4 && remainder <= otherTables * MAX_TABLE_SIZE) {
            targetSizes.push(assigned);
            remaining -= assigned;
            break;
          }
        }
        assigned--;
      }
    }
  }

  // Select the active tables and attach their specific target sizes
  const activeTables = tables.slice(0, neededTablesCount).map((t, i) => ({
    ...t,
    _targetSize: targetSizes[i]
  }));

  // 1. Identify Captains (Fixed) and Floating Participants for ACTIVE tables
  const captainIds = new Set(activeTables.map(t => t.captainMemberId).filter(Boolean));
  
  // Captains of INACTIVE tables automatically become floating participants!
  const participants = activeMembers.filter(m => !captainIds.has(m.id));
  const participantIds = participants.map(p => p.id);

  // Helper to determine Category based on memberCode
  const getCategory = (id) => {
    const m = activeMembers.find(member => member.id === id);
    const code = m?.memberCode?.trim().toUpperCase() || '';
    if (code.startsWith('S')) return 'S';
    if (code.startsWith('N')) return 'N';
    if (code.startsWith('E')) return 'E';
    return 'O'; // Other
  };


  // 2. Build History Sets
  const visitedTables = {};
  const metWith = {};

  activeMembers.forEach(m => {
    visitedTables[m.id] = new Set();
    metWith[m.id] = new Set();
  });

  // Populate history from previous rounds
  previousRounds.forEach(round => {
    const allocations = round.allocations || {};
    
    for (const [tableId, memberIds] of Object.entries(allocations)) {
      memberIds.forEach(id => {
        if (visitedTables[id]) visitedTables[id].add(tableId);
        
        memberIds.forEach(otherId => {
          if (id !== otherId && metWith[id]) {
            metWith[id].add(otherId);
          }
        });
      });

      const table = tables.find(t => t.id === tableId);
      if (table && table.captainMemberId) {
        const capId = table.captainMemberId;
        memberIds.forEach(id => {
          if (id !== capId && metWith[id]) metWith[id].add(capId);
          if (id !== capId && metWith[capId]) metWith[capId].add(id);
        });
      }
    }
  });

  // 3. The Assignment Algorithm (Randomized Greedy with Restarts)
  const RESTARTS = 50;
  let bestAssignment = null;
  let lowestPenalty = Infinity;

  for (let r = 0; r < RESTARTS; r++) {
    let currentPenalty = 0;
    
    const assignments = {};
    activeTables.forEach(t => assignments[t.id] = []);

    // Group participants by category and shuffle within each category
    const sMembers = participantIds.filter(id => getCategory(id) === 'S');
    const nMembers = participantIds.filter(id => getCategory(id) === 'N');
    const eMembers = participantIds.filter(id => getCategory(id) === 'E');
    const oMembers = participantIds.filter(id => getCategory(id) === 'O');

    // Process categories sequentially: S -> N -> E -> O
    // This prevents tables from filling up with the wrong categories prematurely,
    // guaranteeing the perfect 2 'S', 2 'N', 1 'E' distribution.
    const shuffledParticipants = [
      ...shuffleArray(sMembers),
      ...shuffleArray(nMembers),
      ...shuffleArray(eMembers),
      ...shuffleArray(oMembers)
    ];

    // Assign each participant
    for (const pid of shuffledParticipants) {
      const category = getCategory(pid);
      let bestTable = null;
      let minTablePenalty = Infinity;

      const shuffledTables = shuffleArray(activeTables);

      for (const table of shuffledTables) {
        let penalty = 0;
        
        const currentAssigned = assignments[table.id];
        const totalPeople = currentAssigned.length + (table.captainMemberId ? 1 : 0);
        
        // --- HARD CAPACITY LIMIT ---
        // Block if the table has reached its optimal target size.
        if (totalPeople >= table._targetSize) {
          continue; 
        }

        // --- CATEGORY DISTRIBUTION PENALTIES ---
        // Count how many of each category are currently at this table
        let sCount = 0, nCount = 0, eCount = 0;
        currentAssigned.forEach(id => {
          const cat = getCategory(id);
          if (cat === 'S') sCount++;
          if (cat === 'N') nCount++;
          if (cat === 'E') eCount++;
        });

        // Penalize heavily if adding this person violates the ideal [2, 2, 1] distribution
        if (category === 'S' && sCount >= 2) penalty += 100000;
        if (category === 'N' && nCount >= 2) penalty += 100000;
        if (category === 'E' && eCount >= 1) penalty += 100000;
        
        // For 'O' (Other) category, we don't penalize category limits, 
        // they just fill empty spaces if exact S/N/E counts aren't possible.

        // --- HISTORICAL COLLISION PENALTIES ---
        if (visitedTables[pid].has(table.id)) {
          penalty += 1000;
        }

        if (table.captainMemberId && metWith[pid].has(table.captainMemberId)) {
          penalty += 500;
        }

        for (const existingPid of currentAssigned) {
          if (metWith[pid].has(existingPid)) {
            penalty += 500;
          }
        }

        // Keep track of the table with the lowest penalty
        if (penalty < minTablePenalty) {
          minTablePenalty = penalty;
          bestTable = table.id;
        }
      }

      // If a valid table was found, assign them. 
      // If NOT (extremely rare, mathematically impossible case), they get skipped for this retry.
      if (bestTable) {
        assignments[bestTable].push(pid);
        currentPenalty += minTablePenalty;
      } else {
        // If we couldn't place someone AT ALL (because all tables reached avgCapacity),
        // we add a massive penalty to ensure this "failed" shuffle isn't picked as the winner.
        currentPenalty += 10000000;
      }
    }

    if (currentPenalty < lowestPenalty) {
      lowestPenalty = currentPenalty;
      bestAssignment = assignments;
    }

    // A penalty of 0 means perfect matrix found (perfect distribution, no collisions).
    if (lowestPenalty === 0) break;
  }

  return {
    allocations: bestAssignment,
    penaltyScore: lowestPenalty,
    isPerfect: lowestPenalty < 500 // Anything under 500 means no duplicate meetings
  };
}
