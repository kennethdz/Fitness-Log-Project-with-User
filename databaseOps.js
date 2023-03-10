'use strict'

// database operations.
// Async operations can always fail, so these are all wrapped in try-catch blocks
// so that they will always return something
// that the calling function can use. 

module.exports = {
  testDB: testDB,
  post_activity: post_activity,
	post_profile: post_profile,
	check_for_profile: check_for_profile,
  get_most_recent_planned_activity_in_range: get_most_recent_planned_activity_in_range,
  delete_past_activities_in_range: delete_past_activities_in_range,
  get_most_recent_entry: get_most_recent_entry,
  get_similar_activities_in_range: get_similar_activities_in_range,
  get_all: get_all,
	get_name: get_name
}

// using a Promises-wrapped version of sqlite3
const db = require('./sqlWrap');
const profile_db = require('./sqlWrapProfile');

// our activity verifier
const act = require('./activity');

// SQL commands for ActivityTable
const insertDB = "insert into ActivityTable (activity, date, amount) values (?,?,?)"
const getOneDB = "select * from ActivityTable where activity = ? and date = ?";
const allDB = "select * from ActivityTable where activity = ?";
const deletePrevPlannedDB = "DELETE FROM ActivityTable WHERE amount < 0 and date BETWEEN ? and ?";
const getMostRecentPrevPlannedDB = "SELECT rowIdNum, activity, MAX(date), amount FROM ActivityTable WHERE amount <= 0 and date BETWEEN ? and ?";
const getMostRecentDB = "SELECT MAX(rowIdNum), activity, date, amount FROM ActivityTable";
const getPastWeekByActivityDB = "SELECT * FROM ActivityTable WHERE activity = ? and date BETWEEN ? and ? ORDER BY date ASC";

const insertProfile = "insert into Profile (userid, firstName) values (?, ?)";
const getProfile = "SELECT * from Profile WHERE userid = ?";

// Testing function loads some data into DB. 
// Is called when app starts up to put fake 
// data into db for testing purposes.
// Can be removed in "production". 
async function testDB () {
  
  // for testing, always use today's date
  const today = new Date().getTime();
  
  // all DB commands are called using await
  
  // empty out database - probably you don't want to do this in your program
  await db.deleteEverything();
  
  const MS_IN_DAY = 86400000
  let newDate =  new Date(); // today!
  let startDate = newDate.getTime() - 7 * MS_IN_DAY;
  let planDate3 = newDate.getTime() - 3 * MS_IN_DAY;
  let planDate2 = newDate.getTime() - 2 * MS_IN_DAY;
  console.log("today:", startDate)
  
  let dbData = [
    {
      type: 'walk',
      data: Array.from({length: 8}, () => randomNumber(0,1)),
      start: startDate
    },
    {
      type: 'run',
      data: Array.from({length: 8}, () => randomNumber(1,3)),
      start: startDate
    },
    {
      type: 'swim',
      data: Array.from({length: 8}, () => randomNumber(30, 100, false)),
      start: startDate
    },
    {
      type: 'bike',
      data: Array.from({length: 8}, () => randomNumber(5,10)),
      start: startDate
    },
    {
      type: 'yoga',
      data: Array.from({length: 8}, () => randomNumber(30,120,false)),
      start: startDate
    },
    {
      type: 'soccer',
      data: Array.from({length: 8}, () => randomNumber(120,180,false)),
      start: startDate
    },
    {
      type: 'basketball',
      data: Array.from({length: 8}, () => randomNumber(60,120,false)),
      start: startDate
    },
  ]
  
  for(const entry of dbData) {
    for(let i = 0 ; i < entry.data.length; i++) {
      await db.run(insertDB,[entry.type, entry.start + i * MS_IN_DAY, entry.data[i]]);
    }
  }
  

  await db.run(insertDB,["yoga", planDate2, -1]);
  await db.run(insertDB,["yoga", planDate3, -1]);
  await db.run(insertDB,["run", planDate2, -1]);

  // some examples of getting data out of database
  
  // look at the item we just inserted
  let result = await db.get(getOneDB,["run",startDate]);
  console.log("sample single db result",result);
  
  // get multiple items as a list
  result = await db.all(allDB,["walk"]);
  console.log("sample multiple db result",result);
}

/**
 * Insert activity into the database
 * @param {Activity} activity 
 * @param {string} activity.activity - type of activity
 * @param {number} activity.date - ms since 1970
 * @param {float} activity.scalar - measure of activity conducted
 */
async function post_activity(activity) {
  try {
    await db.run(insertDB, act.ActivityToList(activity));
  } catch (error) {
    console.log("error", error)
  }
}
// Checks for profile in database first
// if not found, then 
// Inserts profile userid and givenName as firstName into Profile database
async function post_profile(profile) {
  try {
		let checker = await check_for_profile(profile.id);
		if (checker  == 0)
		 {
			console.log("creating profile.");
			console.log("userid: ", profile.id);
			console.log("firstName: ", profile.name.givenName);
    	await profile_db.run(insertProfile, [profile.id, profile.name.givenName]);
		} else {
			console.log("post cancelled, user already created");
		}
  } catch (error) {
    console.log("error", error)
  }
}

// Checks for profile in database
async function check_for_profile(id) {
  try {
    let checker = profile_db.run(getProfile, [id]);
			if (checker == []) {
				console.log("Profile not found");
				return 0;
		} else {
			console.log("Profile found");
			return 1;
		}
  } catch (error) {
    console.log("error", error)
  }
}


/**
 * Get the most recently planned activity that falls within the min and max 
 * date range
 * @param {number} min - ms since 1970
 * @param {number} max - ms since 1970
 * @returns {Activity} activity 
 * @returns {string} activity.activity - type of activity
 * @returns {number} activity.date - ms since 1970
 * @returns {float} activity.scalar - measure of activity conducted
 */
async function get_most_recent_planned_activity_in_range(min, max) {
  try {
    let results = await db.get(getMostRecentPrevPlannedDB, [min, max]);
    return (results.rowIdNum != null) ? results : null;
  }
  catch (error) {
    console.log("error", error);
    return null;
  }
}



/**
 * Get the most recently inserted activity in the database
 * @returns {Activity} activity 
 * @returns {string} activity.activity - type of activity
 * @returns {number} activity.date - ms since 1970
 * @returns {float} activity.scalar - measure of activity conducted
 */
async function get_most_recent_entry() {
  try {
    let result = await db.get(getMostRecentDB, []);
    return (result['MAX(rowIdNum)'] != null) ? result : null;
  }
  catch (error) {
    console.log(error);
    return null;
  }
}


/**
 * Get all activities that have the same activityType which fall within the 
 * min and max date range
 * @param {string} activityType - type of activity
 * @param {number} min - ms since 1970
 * @param {number} max - ms since 1970
 * @returns {Array.<Activity>} similar activities
 */
async function get_similar_activities_in_range(activityType, min, max) {
  try {
    let results = await db.all(getPastWeekByActivityDB, [activityType, min, max]);
    return results;
  }
  catch (error) {
    console.log(error);
    return [];
  }
}


/**
 * Delete all activities that have the same activityType which fall within the 
 * min and max date range
 * @param {number} min - ms since 1970
 * @param {number} max - ms since 1970
 */
async function delete_past_activities_in_range(min, max) {
  try {
    await db.run(deletePrevPlannedDB, [min, max]);
  }
  catch (error) {
    console.log(error);
  }
}

// UNORGANIZED HELPER FUNCTIONS


/**
 * Convert GMT date to UTC
 * @returns {Date} current date, but converts GMT date to UTC date
 */
function newUTCTime() {
  let gmtDate = new Date()
  return (new Date(gmtDate.toLocaleDateString())).getTime()
}

function randomNumber(min, max, round = true) { 
  let val =  Math.random() * (max - min) + min
  if (round) {
    return Math.round(val * 100) / 100
  } else {
    return Math.floor(val)
  }
}

// dumps whole table; useful for debugging
async function get_all() {
  try {
    let results = await db.all("select * from ActivityTable", []);
    return results;
  } 
  catch (error) {
    console.log(error);
    return [];
  }
}
async function get_name(userid) {
	try {
    let result = await profile_db.get(getProfile, [userid]);
    return result;
  } 
  catch (error) {
    console.log(error);
    return [];
  }
}