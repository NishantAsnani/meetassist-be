const User = require("../models/users");
async function createNewUser(userData) {
  try {
      const { name, email, password } = userData;


    const newUser = await User.create({
      name,
      email,
      password,
    });
    return newUser;
  } catch (err) {
    console.log(err)
    throw new Error(err);
  }
}


module.exports = {
  createNewUser
};