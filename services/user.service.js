const  User  = require("../models/users");

async function fetchUserById(userId) {
  try {
    const user = await User.findById(userId).select('name email institute isGoogleSynced');
    
    return user;
  } catch (err) {
    throw new Error(err);
  }
}

async function deleteUser(userId) {
  try {
    const deletedUser=await User.findByIdAndDelete(userId);
    if (!deletedUser) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    return deletedUser;
  } catch (err) {
    throw err;
  }
}

async function getAllUsers(queryParams){
  try{
    const { page, limit , nameSearch  } = queryParams;
    let whereClause={}
    const offset = (page - 1) * limit; // Calculate offset for pagination
    if (nameSearch) {
      whereClause.name = {
        $regex: nameSearch,
        $options: "i", 
      };
    }

    const allUsers=await User.find(whereClause).skip(offset).limit(limit);
    const totalUsers = await User.countDocuments(whereClause);
    const totalPages = Math.ceil(totalUsers / limit);

    return {
      data: allUsers,
      pagination: {
        totalUsers,
        totalPages,
        currentPage: page,
        limit
      }
    };
  }catch(err){
    throw new Error(err);
  }
} 

async function updateUser(userId,oldData,updateFields) {
  try {

    const cleanedFields = {};
    for (const key in updateFields) {
      if (updateFields[key] !== undefined && updateFields[key] !== oldData[key]) {
        cleanedFields[key] = updateFields[key];
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: cleanedFields },
      { new: true } 
    );

    if (!updatedUser) {
      throw new Error(`User with ID ${userId} not found`);
    }

    return updatedUser;
  } catch (error) {
    throw new Error(error);
  }
}


module.exports = {
  fetchUserById,
  deleteUser,
  getAllUsers,
  updateUser
};