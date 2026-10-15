In this folder, we can define the logic for serivices. 

For example say we had out /sigup endpoint, and we wanted to have the logic for signing up a user.
The endpoint would properly clean up the request, where as we could define a file called user_service.py
which would contain the actual method that interacts with the database through SQL queries.
