const {onCall,HttpsError}=require("firebase-functions/v2/https");
const {setGlobalOptions}=require("firebase-functions/v2");
const {initializeApp}=require("firebase-admin/app");
const {getAuth}=require("firebase-admin/auth");
const {getDatabase}=require("firebase-admin/database");

initializeApp();
setGlobalOptions({region:"europe-west1",maxInstances:3});

function collectUserPaths(value,targetUid,basePath,updates){
  if(value===null||typeof value!=="object")return;

  for(const [key,child] of Object.entries(value)){
    const path=basePath?`${basePath}/${key}`:key;

    if(key===targetUid){
      updates[path]=null;
      continue;
    }

    if(child&&typeof child==="object"&&child.uid===targetUid){
      updates[path]=null;
      continue;
    }

    collectUserPaths(child,targetUid,path,updates);
  }
}

exports.deleteBingoUser=onCall(async request=>{
  if(!request.auth){
    throw new HttpsError("unauthenticated","You must be signed in.");
  }

  const targetUid=String(request.data?.targetUid||"").trim();

  if(!targetUid){
    throw new HttpsError("invalid-argument","Missing target user.");
  }

  if(targetUid===request.auth.uid){
    throw new HttpsError("failed-precondition","You cannot delete your own admin account here.");
  }

  const db=getDatabase();
  const adminSnap=await db.ref(`v2/admins/${request.auth.uid}`).get();

  if(adminSnap.val()!==true){
    throw new HttpsError("permission-denied","Admin access required.");
  }

  const targetAdminSnap=await db.ref(`v2/admins/${targetUid}`).get();

  if(targetAdminSnap.val()===true){
    throw new HttpsError("failed-precondition","Admin accounts cannot be deleted from the Host panel.");
  }

  // Verify the auth account exists before changing the database.
  try{
    await getAuth().getUser(targetUid);
  }catch(error){
    if(error.code!=="auth/user-not-found")throw error;
  }

  const updates={
    [`v2/profiles/${targetUid}`]:null,
    [`v2/publicProfiles/${targetUid}`]:null,
    [`v2/lobby/${targetUid}`]:null,
    [`v2/gamePlayers/${targetUid}`]:null,
    [`v2/kicks/${targetUid}`]:null,
    [`v2/transactions/${targetUid}`]:null,
    [`v2/rewards/${targetUid}`]:null,
    [`v2/purchaseRequests/${targetUid}`]:null
  };

  // Remove historical claims and winner records that contain the UID.
  const [claimsSnap,winnersSnap]=await Promise.all([
    db.ref("v2/claims").get(),
    db.ref("v2/verifiedWinners").get()
  ]);

  collectUserPaths(claimsSnap.val(),targetUid,"v2/claims",updates);
  collectUserPaths(winnersSnap.val(),targetUid,"v2/verifiedWinners",updates);

  await db.ref().update(updates);

  try{
    await getAuth().deleteUser(targetUid);
  }catch(error){
    if(error.code!=="auth/user-not-found"){
      throw new HttpsError("internal","Profile data was removed but Firebase Authentication deletion failed.");
    }
  }

  return {ok:true,targetUid};
});
