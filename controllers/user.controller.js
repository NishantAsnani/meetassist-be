const  User  = require("../models/users");
const { sendSuccessResponse, sendErrorResponse } = require("../utils/response");
const { STATUS_CODE } = require("../utils/constants");
const userServices = require("../services/user.service");



async function getAllUsers(req, res) {
  try {

    const page=req.query.page? parseInt(req.query.page) : 1;
    const limit=req.query.limit? parseInt(req.query.limit) : 10;
    const nameSearch = req.query.name ? req.query.name : '';


    const allUsers = await userServices.getAllUsers({
      page,
      limit,
      nameSearch
    });

    
    if(allUsers) {
      return sendSuccessResponse(
      res,
      {users:allUsers.data,pagination:allUsers.pagination},
      "Users Retrieved Successfully",
      STATUS_CODE.OK
    );
    }
    
  } catch (err) {
    return sendErrorResponse(
      res,
      {},
      `Error Retrieving Users: ${err.message}`,
      STATUS_CODE.INTERNAL_SERVER_ERROR
    );
  }
}

async function getUserById(req, res) {
  try {
    const userId = req.params.id;
    
    if(!userId) {
      return sendErrorResponse(
        res,
        {},
        "User ID is required",
        STATUS_CODE.BAD_REQUEST
      );
    }

    const fetchUser = await userServices.fetchUserById(userId);

    if(!fetchUser) {
      return sendErrorResponse(
        res,
        {},
        "User Not Found",
        STATUS_CODE.NOT_FOUND
      );
    }

    
      return sendSuccessResponse(
        res,
        fetchUser,
        "User Retrieved Successfully",
        STATUS_CODE.OK
      );
    
    
  } catch (err) {
    return sendErrorResponse(
      res,
      {},
      `Error Retrieving User: ${err.message}`,
      STATUS_CODE.INTERNAL_SERVER_ERROR
    );
  }
}

async function deleteUser(req, res) {
  try {
    const userId = req.params.id;
    
    if(!userId) {
      return sendErrorResponse(
        res,
        {},
        "User ID is required",
        STATUS_CODE.BAD_REQUEST
      );
    }

    const deletedUser= await userServices.deleteUser(userId);

    if(deletedUser) {
      return sendSuccessResponse(
        res,
        deletedUser.data,
        "User Deleted Successfully",
        STATUS_CODE.OK
      );
    } 
  } catch (err) {
    return sendErrorResponse(
      res,
      {},
      `Error Retrieving User: ${err.message}`,
      STATUS_CODE.INTERNAL_SERVER_ERROR
    );
  }
}

async function editUser(req, res) {
  try {
    const userId = req.params.id;
    const { name, email, password } = req.body;

    if (!userId) {
      return sendErrorResponse(
        res,
        {},
        "User ID is required",
        STATUS_CODE.BAD_REQUEST
      );
    }

    const existingUser = await userServices.fetchUserById(userId);

    if (!existingUser) {
      return sendErrorResponse(
        res,
        {},
        "User Not Found",
        STATUS_CODE.NOT_FOUND
      );
    }


    

    const updatedUser = await userServices.updateUser(userId,existingUser,{ name, email, password });

    if (updatedUser) {
      return sendSuccessResponse(
        res,
        updatedUser.data,
        "User Updated Successfully",
        STATUS_CODE.OK
      );
    } 

  } catch (err) {
    return sendErrorResponse(
      res,
      {},
      `Error Updating User: ${err.message}`,
      STATUS_CODE.INTERNAL_SERVER_ERROR
    );
  }
}



module.exports={
    getAllUsers,
    getUserById,
    deleteUser,
    editUser
}