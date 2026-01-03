// this will act as an in-memory data manager to store frequently accessed data
class DataManager {
  constructor() {
    // Initialize maps to store data
    // Key: ID, Value: Data Object
    this.userMap = new Map(); // Key: userID, Value: User Object
    this.bookMap = new Map(); // Key: bookObjectID, Value: Book Object
    this.bookIDMap = new Map(); // Key: bookID, Value: bookObjectID
    this.transactionMap = new Map(); // Key: transactionObjectID, Value: Transaction Object
    this.userMonthlyTransactionIDs = new Map(); // Key: "userID_year_month_bookID", Value: [transactionIDs]
  }

  async setUserMap(userObject) {
    this.userMap.set(userObject.userID, userObject);
    console.log("User added to userMap:", userObject.userID);
  }
  async getUserMap(userID) {
    return this.userMap.get(userID);
  }
  async setBookMap(bookObject) {
    this.bookMap.set(bookObject._id.toString(), bookObject);
    this.bookIDMap.set(bookObject.bookID, bookObject._id.toString());
  }
  async getBookMapByID(bookID) {
    const bookObjectID = this.bookIDMap.get(bookID);
    return this.bookMap.get(bookObjectID);
  }
  async getBookByObjectID(bookObjectID) {
    return this.bookMap.get(bookObjectID);
  }
  async setTransactionMap(transactionObjectID, transactionObject) {
    this.transactionMap.set(transactionObjectID, transactionObject);
  }
  async getTransactionMap(transactionObjectID) {
    return this.transactionMap.get(transactionObjectID);
  }
  async setUserMonthlyTransactionMap(monthTransactionArrayObject) {
    monthTransactionArrayObject.forEach((transaction) => {
      const bookID = transaction._id.bookID;
      const year = transaction._id.year;
      const month = transaction._id.month;

      this.setTransactionMap(
        transaction.lastTransaction._id.toString(),
        transaction.lastTransaction
      );

      transaction.lastTransaction.userID.forEach((userID) => {
        const key = `${userID}_${year}_${month}_${bookID}`;
        if (!this.userMonthlyTransactionIDs.has(key)) {
          this.userMonthlyTransactionIDs.set(key, []);
        }
        const userTransactionArray = this.userMonthlyTransactionIDs.get(key);
        if (
          !userTransactionArray.includes(
            transaction.lastTransaction._id.toString()
          )
        ) {
          this.userMonthlyTransactionIDs
            .get(key)
            .push(transaction.lastTransaction._id.toString());
        }
      });
    });
  }
  async getUserMonthlyTransactionIDs(userID, year, month, bookID) {
    const key = `${userID}_${year}_${month}_${bookID}`;
    return this.userMonthlyTransactionIDs.get(key) || [];
  }
  async clearAllData() {
    this.userMap.clear();
    this.bookMap.clear();
    this.bookIDMap.clear();
    this.transactionMap.clear();
    this.userMonthlyTransactionIDs.clear();
  }
  async getAllMapsData() {
    console.log("Fetching all maps data from DataManager");
    console.log("userMap size:", this.userMap.size);

    // Convert Maps to plain objects for JSON serialization
    return {
      userMap: Object.fromEntries(this.userMap),
      bookMap: Object.fromEntries(this.bookMap),
      bookIDMap: Object.fromEntries(this.bookIDMap),
      transactionMap: Object.fromEntries(this.transactionMap),
      userMonthlyTransactionIDs: Object.fromEntries(
        Array.from(this.userMonthlyTransactionIDs).map(([key, value]) => [
          key,
          Array.from(value),
        ])
      ),
    };
  }
}

export const dataManager = new DataManager();
