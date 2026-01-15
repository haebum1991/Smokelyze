## shiny packages
suppressPackageStartupMessages(library("shiny"))
suppressPackageStartupMessages(library("shinyjs"))
suppressPackageStartupMessages(library("shinydashboard"))
suppressPackageStartupMessages(library("htmltools"))

# Define UI ----
ui <- fluidPage(
  shinyjs::useShinyjs(),
  
  ## UI login page
  div(
    id = "login_page",
    
    fluidRow(
      column(4, 
             offset = 4,
             
             wellPanel(
               class = "login-panel",
               
               h2("Welcome to Login Page!"),
               
               textInput(inputId = "subscribe_email", 
                         label = HTML('Email (<span style="color: red;">required</span>)'), 
                         value = ""),
               
               textInput(inputId = "subscribe_affil", 
                         label = "Affiliation (optional)", value = "")
             ),
             column(12,
                    style = "text-align: right;",
                    actionButton(inputId = "login_btn", 
                                 label = "Go to app")
             )
      )
    )
  )
)

# Server part ----
server <- function(input, output, session) {
  
}

# Run the app ----
shinyApp(ui = ui,
         server = server)
